const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');
const csv = require('csvtojson');
const pathToPointFile = path.join(__dirname, 'RawInput/points.csv');
const toleranceValue = 0.01;

const Counter = (function() {
    let counterValue = 0;
    return {
        increment: function() {
            return counterValue++;
        },
        decrement: function() {
            return counterValue--;
        },
        getCurrent: function() {
            return counterValue;
        }
    }
});
const pipeId = new Counter;
const nodeId = new Counter;
//Helper Functions
function round(value) {
    return Number(value.toFixed(4));
};
function changeState(input) {
    let output;
    if (Array.isArray(input)) {
        output = {};
        input.forEach(subObj => {
            let subObjId = subObj.id;
            delete subObj.id;
            output[subObjId] = subObj;
        })
    } else {
        output = [];
        for (subObj in input) {
            output.push({
                ...input[subObj],
                id: Number(subObj)
            })
        }
    }
    return output;
};
function duplicatePoint(checkPoint, points) {
    let filteredPoints = points.filter( point => point.x === checkPoint.x && point.y === checkPoint.y);
    return (filteredPoints.length > 0) ? {value: true, point: filteredPoints[0]} : {value: false, point: checkPoint};
};
function clean(input) {
    return JSON.parse(JSON.stringify(input));
};

//Main Functions

let get = (function() {
    function resolveLineCollisions(lines, points, collisions) {
        let collisionRegistry = {};
        collisions.forEach(collision => {
            let { line, secondLine, xCollision } = collision;
            let newPoint, newLine, newSecondLine;
            if (collisionRegistry[line.id] === secondLine.id) return; //These two lines have already collided.
            collisionRegistry[secondLine.id] = line.id; //Add this Id to the collision registry to prevent these two lines colliding again.
            newPoint = duplicatePoint({
                x: xCollision,
                y: round(line.equation.grad * xCollision + line.equation.yInt)
            }, changeState(points));
            if (this.length(newPoint.point, points[line.endNode]) < toleranceValue || this.length(newPoint.point, points[secondLine.endNode]) < toleranceValue) return; //If your length is 0 so is your worth.
            if (!newPoint.value) {
                newPoint = newPoint.point;
                points[nodeId.getCurrent()] = clean(newPoint);
                newPoint.id = nodeId.increment();
            };
            newLine = {
                startNode: newPoint.id,
                endNode: line.endNode,
                length: this.length(newPoint, points[line.endNode]),
                lineId: line.lineId
            };
            newSecondLine = {
                startNode: newPoint.id,
                endNode: secondLine.endNode,
                length: this.length(newPoint, points[secondLine.endNode]),
                lineId: secondLine.lineId
            };
            //Add two new lines because of the breakpoint.
            lines[pipeId.increment()] = newLine;
            lines[pipeId.increment()] = newSecondLine;
            //Edit the two existing lines to end at the new collision point.
            lines[line.id].endNode = newPoint.id;
            lines[line.id].length = this.length(points[lines[line.id].startNode], points[lines[line.id].endNode]);
            lines[secondLine.id].endNode = newPoint.id;
            lines[secondLine.id].length = this.length(points[lines[secondLine.id].startNode], points[lines[secondLine.id].endNode]);
        });
        return {
            lines: lines,
            points: points
        }
    };
    function resolvePointCollisions(lines, points, collisions) {
    };
    function lineEquation(startNode, endNode) {
        let isVertical = (startNode.x - endNode.x === 0) ? true : false; //Checking if this is a vertical line.
        let grad = (isVertical) ? startNode.x : (startNode.y - endNode.y)/(startNode.x - endNode.x);
        let yInt = (isVertical) ? null : startNode.y - grad * startNode.x;
        return {
            isVertical: isVertical,
            grad: grad,
            yInt: yInt
        }
    };
    function lineExtents(line1StartNode, line1EndNode, line2StartNode, line2EndNode) {
        return {
            min: Math.max(Math.min(line1StartNode.x, line1EndNode.x), Math.min(line2StartNode.x, line2EndNode.x)),
            max: Math.min(Math.max(line1StartNode.x, line1EndNode.x), Math.max(line2StartNode.x, line2EndNode.x))
        }
    };
    return {
        lineCollisions: function(lines, points) {
            let collisionCounter = new Counter;
            let collisions = [];
            changeState(lines).forEach((line, i) => {
                line.equation = lineEquation(points[line.startNode], points[line.endNode])
                changeState(lines).forEach((secondLine, r) => {
                    secondLine.equation = lineEquation(points[secondLine.startNode], points[secondLine.endNode]);
                    if (line.equation.grad === secondLine.equation.grad || (line.equation.isVertical && secondLine.equation.isVertical)) return; //Lines have the same gradient and will never meet (paralell).
                    let xCollision = round((line.equation.yInt-secondLine.equation.yInt)/(secondLine.equation.grad-line.equation.grad));
                    if (line.equation.isVertical) xCollision = line.equation.grad;
                    if (secondLine.equation.isVertical) xCollision = secondLine.equation.grad;
                    let xOverlap = lineExtents(points[line.startNode], points[line.endNode], points[secondLine.startNode], points[secondLine.endNode]);
                    if (Math.abs(xCollision - xOverlap.min) >= toleranceValue && Math.abs(xCollision - xOverlap.max) >= toleranceValue) {
                        collisions.push({
                            id: collisionCounter.increment(),
                            line: line,
                            secondLine: secondLine,
                            xCollision: xCollision
                        });
                    }
                })
            });
            return resolveLineCollisions.call(this, lines, points, collisions);
        },
        pointCollisions: function(lines, points) {

        },
        length: function(point1, point2) {
            return round(Math.sqrt(Math.pow(Math.abs(point1.x - point2.x), 2) + Math.pow(Math.abs(point1.y - point2.y), 2)));
        }
    }
})();

let load = {
    shapeFile: async function(shapeFilePath) {
        let output = [];
        let points = {};
        let lines = {};
        let pointId, lastPointId, lineId;
        let lineCounter = new Counter;
        await shapefile.open(shapeFilePath)
            .then(source => source.read()    
                .then(function readShapeFile(result) {
                    if (result.done) return;
                    output.push(result.value)
                    return source.read().then(readShapeFile);
                })
            )
        output.forEach(feature => {
            if (feature.type !== 'Feature') throw new Error('Unrecognised feature type of: ' + feature.type);
            if (feature.geometry.type !== 'LineString') throw new Error('Unrecognised feature type of: ' + feature.geometry.type);
            lineId = lineCounter.increment();
            feature.geometry.coordinates.forEach((point, i) => {
                if (i === feature.geometry.coordinates.length-1) return;
                if (i === 0) { //If it's the first element, create two so that the first line can join to something.
                    lastPointId = nodeId.increment();
                    points[lastPointId] = {
                        x: round(point[0]),
                        y: round(point[1])
                    }
                }
                pointId = nodeId.increment();
                points[pointId] = {
                    x: round(feature.geometry.coordinates[i + 1][0]),
                    y: round(feature.geometry.coordinates[i + 1][1])
                };
                lines[pipeId.increment()] = {
                    startNode: lastPointId,
                    endNode: pointId,
                    length: get.length(points[pointId], points[lastPointId]),
                    lineId: lineId
                };
                lastPointId = pointId;
            });
        });
        return {
            points: points,
            lines: lines
        };
    },
    pointFile: async function(pointFilePath) {
        return csv({
            noheader: true,
            trim: true,
            delimiter:[","],
            output:"csv"
        })
            .fromFile(pointFilePath)
            .then(data => {
                return {
                    x: data[0],
                    y: data[1],
                    z: data[2]
                }
            });
    }
}


// function loadPipeNetworks(networkArray) {
//     networkArray.forEach(network => {
//         let { shapefilePath, pointFilePath, forcedPointsPath, options } = network;
//         let { checkInternalCollisions, checkGlobalCollisions, pipeDia } = options;

        


//     })
// }