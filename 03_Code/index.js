const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');
const csv = require('csvtojson');
const pathToLineFile = path.join(__dirname, 'RawInput/shapey.shp');
const pathToPointFile = path.join(__dirname, 'RawInput/points.csv');

async function getShapeFile(pathToInput) {
    let output = [];
    await shapefile.open(pathToInput)
        .then(source => source.read()    
            .then(function readShapeFile(result) {
                if (result.done) return;
                output.push(result.value)
                return source.read().then(readShapeFile);
            })
        )
    return output;
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

function processLineFile(lineFile) {
    let rawLineInformation = [];
    let pipeCounter = 0;
    lineFile.forEach(feature => {
        if (feature.type !== 'Feature') throw new Error('Unrecognised feature type of: ' + feature.type);
        if (feature.geometry.type !== 'LineString') throw new Error('Unrecognised feature type of: ' + feature.geometry.type);
        let vertCounter = 0;
        for (let i = 0; i<feature.geometry.coordinates.length; i++) {
            if (!(i+1 >= feature.geometry.coordinates.length)) {
                let coord1 = feature.geometry.coordinates[i];
                let coord2 = feature.geometry.coordinates[i+1];
                rawLineInformation.push({
                    coord1: coord1,
                    coord2: coord2,
                    vertNo : vertCounter,
                    pipeNo : pipeCounter
                });
                vertCounter++;
            };
        };
        pipeCounter++;
    });
    return Promise.resolve(rawLineInformation);
};

function solveLineCollisions(points, existingLines) {
    function findPointInArray(node) {
        return points.filter(point => node === point.id)[0];
    }
    let lines = JSON.parse(JSON.stringify(existingLines));
    existingLines.forEach((line, i) => {
        //Calculate linear equation of first line.
        let { startNode, endNode } = line;
        startNode = findPointInArray(startNode);
        endNode = findPointInArray(endNode);
        let m = (startNode.y-endNode.y)/(startNode.x-endNode.x);
        let b = startNode.x+m*startNode.y;
        let minX = Math.min(startNode.x, endNode.x);
        let maxX = Math.max(startNode.x, endNode.x);

        existingLines.forEach((secondLine, r) => {
            //Calculate Linear Equation of Second Line
            let { startNode, endNode } = secondLine;
            startNode = findPointInArray(startNode);
            endNode = findPointInArray(endNode);
            let q = (startNode.y-endNode.y)/(startNode.x-endNode.x);
            let c = startNode.x+m*startNode.y;
            if (m === q) return; //Lines are parallel and will never meet.
            //Check for collision between lines.
            collisionX = (c-b)/(m-q);
            //If the collision exists on the extent of the lines, then add it.
            if (collisionX > minX && collisionX < maxX) { 
                //Create new point and add to pointArray.
                newPoint = {
                    id: getPointId(),
                    x: collisionX,
                    y: m*collisionX+b,
                    z: null
                };
                points.push(newPoint);
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
                //Edit the two existing lines to be shorter and finish at the new break point.
                lines[i].endNode = newPoint.id
                lines[r].endNode = newPoint.id
            };
        });
    });
    return {
        points: points,
        lines: lines
    }
};

/* EXPECTED SCHEMA
    Junction : id, elev, demand (0), pattern (empty).
    Pipe : id, node1, node2, length, diameter, roughness (100), minorloss (0), status (open)
    coordinates : node, x-coord, y-coord
    vertices : link [which pipe], x-coord, y-coord
*/
function containsObject(obj, list) {
    for (let i = 0; i < list.length; i++) {
        if (list[i].x === obj[0] && list[i].y === obj[1]) {
            return [false, list[i]]
        }
    }
    return [true, null];
};

let pointCounter = 0;
function getPointId() {
    return pointCounter++;
}
let lineCounter = 0;
function getLineId() {
    return lineCounter++
}

function calcLength(point1, point2) {
    return Math.sqrt(Math.pow(Math.abs(point1.x - point2.x), 2) + Math.pow(Math.abs(point1.y - point2.y), 2))
};

console.log('BlueBarn Parser Tool Started.');
Promise.all([
    getShapeFile(pathToLineFile).then(x => processLineFile(x)),
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
            startNode: point.id,
            endNode: point2.id,
            length: calcLength(point, point2)
        })
    });
    let solvedLines = solveLineCollisions(points, lines);
    return {
        points: solvedLines.points.map(point => {
            point = {
                id: point.id,
                x: point.x.toFixed(4),
                y: point.y.toFixed(4),
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
})

