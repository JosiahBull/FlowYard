const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');
const csv = require('csvtojson');
const pathToLineFile = path.join(__dirname, 'RawInput/shapey.shp');
const pathToPointFile = path.join(__dirname, 'RawInput/points.csv');

const toleranceValue = 0.01;

async function getShapeFile(pathToInput) {
    let output = [];
    let rawLineInformation = [];
    await shapefile.open(pathToInput)
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
        for (let i = 0; i<feature.geometry.coordinates.length; i++) {
            if (!(i + 1 >= feature.geometry.coordinates.length)) {
                let coord1 = [Number(feature.geometry.coordinates[i][0].toFixed(4)), Number(feature.geometry.coordinates[i][1].toFixed(4))];
                let coord2 = [Number(feature.geometry.coordinates[i+1][0].toFixed(4)), Number(feature.geometry.coordinates[i+1][1].toFixed(4))];
                if (calcLength({x: coord1[0], y: coord1[1]}, {x: coord2[0], y: coord2[1]}) === 0) return; //If your length is zero, so is your worth.
                rawLineInformation.push({
                    coord1: coord1,
                    coord2: coord2
                });
            };
        };
    })
    return rawLineInformation;
};

function getCSVFile(pathToInput) {
    return csv({
        noheader: true,
        trim: true,
        delimiter:[","],
        output:"csv"
    })
        .fromFile(pathToInput)
};

function solveLineCollisions(existingPoints, existingLines) {
    let firstLineVertical = false;
    let secondLineVertical = false;
    let collisionRegistry = {};
    function findPointInArray(node) {
        return points.filter(point => node === point.id)[0];
    };
    function recalculateLength(line) {
        let { startNode, endNode } = line;
        startNode = findPointInArray(startNode);
        endNode = findPointInArray(endNode);
        return calcLength(startNode, endNode);
    };
    let lines = JSON.parse(JSON.stringify(existingLines));
    let points = JSON.parse(JSON.stringify(existingPoints));
    existingLines.forEach((line, i) => {
        //Calculate linear equation of first line.
        let { startNode, endNode } = line;
        let m, b;
        startNode = findPointInArray(startNode);
        endNode = findPointInArray(endNode);

        if (startNode.x - endNode.x === 0) {
            firstLineVertical = true;
            m = startNode.x;
        } else {
            m = (startNode.y - endNode.y)/(startNode.x - endNode.x);
            b = startNode.y - m * startNode.x;
        }

        let minX_line = Math.min(startNode.x, endNode.x);
        let maxX_line = Math.max(startNode.x, endNode.x);

        existingLines.forEach((secondLine, r) => {
            //Calculate Linear Equation of Second Line
            let { startNode, endNode } = secondLine;
            let q, c;
            startNode = findPointInArray(startNode);
            endNode = findPointInArray(endNode);
            if (startNode.x - endNode.x === 0) {
                secondLineVertical = true;
                q = startNode.x;
            } else {
                q = (startNode.y-endNode.y)/(startNode.x-endNode.x);
                c = startNode.y - q * startNode.x;
            }
            if (m === q || (firstLineVertical && secondLineVertical)) return; //Lines are parallel and will never meet.

            //Calculate min/max values for x.
            minX = Math.max(Math.min(startNode.x, endNode.x), minX_line);
            maxX = Math.min(Math.max(startNode.x, endNode.x), maxX_line);

            //Check for collision between lines.
            if (firstLineVertical && (q*m+c) === (q*m+c)) collisionX = m;
            if (secondLineVertical && (m*q+b) === (m*q+b)) collisionX = q;    
            if (!firstLineVertical && !secondLineVertical) collisionX = Number(((b-c)/(q-m)).toFixed(4));

            //If the collision exists on the extent of the lines, then add it.
            if ((collisionX > minX && collisionX < maxX) || firstLineVertical || secondLineVertical) {
                if (collisionRegistry[line.id] === secondLine.id) return; //Check that this collision hasn't occured before with these two pipes.
                collisionRegistry[line.id] = secondLine.id;
                collisionRegistry[secondLine.id] = line.id;
                //Create new point and add to pointArray.
                newPoint = {
                    x: Number(collisionX.toFixed(4)),
                    y: Number((m * collisionX + b).toFixed(4)),
                };
                let checkPoint = containsObject([newPoint.x, newPoint.y], points);
                if(!checkPoint[0]) {
                    newPoint = checkPoint[1];
                } else {
                    newPoint.id = getPointId();  
                };
                if (calcLength(newPoint, findPointInArray(lines[i].endNode)) < toleranceValue || calcLength(newPoint, findPointInArray(lines[r].endNode)) < toleranceValue) return; //Check if the new lines that will be created will actually have length. If they won't then don't bother.
                if (checkPoint[0]) {
                    points.push(newPoint);  
                }
                //Add two new lines because of new breakpoints.
                lines.push({
                    id: getLineId(),
                    startNode: newPoint.id,
                    endNode: lines[i].endNode,
                    length: calcLength(newPoint, findPointInArray(lines[i].endNode))
                });
                lines.push({
                    id: getLineId(),
                    startNode: newPoint.id,
                    endNode: lines[r].endNode,
                    length: calcLength(newPoint, findPointInArray(lines[r].endNode))
                });
                // Edit the two existing lines to be shorter and finish at the new break point.
                lines[i].endNode = newPoint.id;
                lines[i].length = recalculateLength(lines[i]);
                lines[r].endNode = newPoint.id;
                lines[r].length = recalculateLength(lines[r]);
            };
        });

        existingPoints.forEach((secondPoint, r) => {
            if(secondPoint.x > minX_line && secondPoint.x < maxX_line) { //Does the x of the point fall within the range of the line.
                if (Math.abs((m*secondPoint.x+b) - secondPoint.y) < toleranceValue) { //Does the y of the point match with the calcuated value of the point's y at that x.
                    //That point lies on the line here. Lets break the line around him.
                    if (calcLength(secondPoint, lines[i].endNode) < toleranceValue) return; //Check that new line isn't gonna have a length of 0,
                    lines.push({
                        id: getLineId(),
                        startNode: secondPoint.id,
                        endNode: lines[i].endNode,
                        length: calcLength(secondPoint, lines[i].endNode)
                    })
                    lines[i].endNode = secondPoint.id;
                    lines[i].length = recalculateLength(lines[i]);
                }
            };
        });

    });
    return {
        points: points,
        lines: lines
    }
};

function containsObject(obj, list) {
    for (let i = 0; i < list.length; i++) {
        if ((Math.abs(list[i].x - obj[0]) < toleranceValue) && (Math.abs(list[i].y - obj[1]) < toleranceValue)) {
            return [false, list[i]]
        }
    }
    return [true, null];
};

let pointCounter = 0;
function getPointId() {
    return pointCounter++;
};
let lineCounter = 0;
function getLineId() {
    return lineCounter++
};

function calcLength(point1, point2) {
    return Number(Math.sqrt(Math.pow(Math.abs(point1.x - point2.x), 2) + Math.pow(Math.abs(point1.y - point2.y), 2)).toFixed(4));
};

console.log('Blue Barn Parser Tool Started.');
Promise.all([
    getShapeFile(pathToLineFile),
    getCSVFile(pathToPointFile).then(x => x.map(point => {
        return {
            x: Number(point[0]).toFixed(4),
            y: Number(point[1]).toFixed(4),
            z: Number(point[2]).toFixed(4)
        };
    }))
]).then(x => {
    return {
        rawLineInformation: x[0],
        rawPointInformation: x[1]
    }
}).then(shapeInformation => {
    let { rawLineInformation, rawPointInformation } = shapeInformation;
    let points = [];
    let lines = [];
    rawLineInformation.forEach(line => {
        let point = containsObject(line.coord1, points);
        if (point[0]) {
            point = {
                id: getPointId(),
                x: line.coord1[0],
                y: line.coord1[1]
            }
            points.push(point)
        } else {
            point = point[1];
        }
        let point2 = containsObject(line.coord2, points);
        if (point2[0]) {
            point2 = {
                id: getPointId(),
                x: line.coord2[0],
                y: line.coord2[1]
            }
            points.push(point2);
        } else {
            point2 = point2[1];
        }
        lines.push({
            id: getLineId(),
            startNode: (point.x > point2.x) ? point.id : point2.id,
            endNode: (point.x > point2.x) ? point2.id : point.id,
            length: calcLength(point, point2)
        })
        // if (calcLength(point, point2) === 0) {
        //     console.log('big bad');
        //     console.log({
        //         line: line
        //     })
        // }
    });
    let solvedLines = solveLineCollisions(points, lines);
    return {
        points: solvedLines.points.map(point => {
            point = {
                id: point.id,
                x: point.x,
                y: point.y,
                z: 0
            };
            let elevPoint = containsObject([point.x, point.y], rawPointInformation);
            if (elevPoint[0]) {
                return point;
            } else {
                elevPoint[1].id = point.id;
                return elevPoint[1];
            }
        }),
        lines: solvedLines.lines
    };
}).then(shapeInformation => {
    let { lines, points } = shapeInformation;
    let saveFile = '[TITLE]\nbluebarn\n\n[JUNCTIONS]\n;ID              	Elev        	Demand      c	Pattern         \n';
    points.forEach(junction => {
        saveFile += ` ${junction.id}              	${junction.z}           	0           	                	;\n`;
    });
    saveFile += '\n[PIPES]\n;ID              	Node1           	Node2           	Length      	Diameter    	Roughness   	MinorLoss   	Status\n';
    lines.forEach(pipe => {
        saveFile += ` ${pipe.id}              	${pipe.startNode}              	${pipe.endNode}              	${pipe.length}          	12          	100         	0           	Open  	;\n`;
    });
    saveFile += '\n[COORDINATES]\n;Node            	X-Coord         	Y-Coord\n';
    points.forEach(coordinate => {
        saveFile += ` ${coordinate.id}              	${coordinate.x}              	${coordinate.y}\n`;
    });
    saveFile += '\n[END]\n';

    fs.writeFileSync('forProcessing.inp', saveFile, 'utf-8');
}).catch(err => {
    console.log('\nAn error occured!\n');
    console.error(err.stack);
}).finally(() => {
    console.log('File has finished processing. :)');
});