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
}

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

function solveLineCollisions(lineInformation) {
    let outputCollisions = [];
    let remaining = JSON.parse(JSON.stringify(lineInformation));
    lineInformation.forEach((line, i) => {
        //Calculate Linear Equation of First Line
        let { coord1, coord2 } = line;
        let m = (coord1[1]-coord2[1])/(coord1[0]-coord2[0]);
        let b = coord1[0]+m*coord1[1];
        let minX = Math.min(coord1[0], coord2[0]);
        let maxX = Math.max(coord2[0], coord2[0]);
        remaining.forEach((secondLine, x) => {
            //Calculate Linear Equation of Second Line
            let { coord1, coord2 } = secondLine;
            let q = (coord1[1]-coord2[1])/(coord1[0]-coord2[0]);
            let c = coord1[0]+m*coord1[1];
            if (m === q) return; //Lines are parallel and will never meet.
            //Check for collision between lines.
            collisionX = (c-b)/(m-q);
            //If the collision exists on the extent of the lines, then add it.
            if (collisionX > minX && collisionX < maxX) {
                outputCollisions.push([
                    collisionX,
                    m*collisionX+b //Calculate Y value.
                ]);

                

            };
        });
    });
    return outputCollisions;
};

function saveOuput(junctions, pipes, coordinates, vertices){
    if (junctions === undefined) {
        console.warn('No junction information resolved.');
        junctions = [];
    }
    if (pipes === undefined) {
        console.warn('No pipes information resolved.');
        pipes = [];
    }
    if (coordinates === undefined) {
        console.warn('No coordinate information resolved.');
        coordinates = [];
    }
    if (vertices === undefined) {
        console.warn('No vertex information resolved.');
        vertices = [];
    }

    let pipeCounter = 0;
    let nodeCounter = 0;
    let saveFile = '[TITLE]\nbluebarn\n\n[JUNCTIONS]\n';
    
    fs.writeFileSync('forProcessing.inp', saveFile, 'utf-8');
};

console.log('BlueBarn Parser Tool Started.');

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

Promise.all([
    getShapeFile(pathToLineFile).then(x => processLineFile(x)),
    getCSVFile(pathToPointFile)
]).then(x => {
    return {
        rawLineInformation: x[0],
        rawPointInformation: x[1]
    }
}).then(shapeInformation => {
    let pointCounter = 0;
    let lineCounter = 0;
    let points = [];
    let lines = [];
    solveLineCollisions(shapeInformation.rawLineInformation).forEach(collision => {
        points.push({
            id: pointCounter,
            x: collision[0],
            y: collision[1],
            z: null
        })
        pointCounter++;
    });
    shapeInformation.rawLineInformation.forEach(line => {
        let point = containsObject(line.coord1, points);
        if (point[0]) {
            points.push({
                id: pointCounter,
                x: line.coord1[0],
                y: line.coord1[1],
                z: null
            })
            point = {
                id: pointCounter,
                x: line.coord1[0],
                y: line.coord1[1],
                z: null
            }
            pointCounter++;
        } else {
            point = point[1];
        }
        let point2 = containsObject(line.coord2, points);
        if (point2[0]) {
            points.push({
                id: pointCounter,
                x: line.coord2[0],
                y: line.coord2[1],
                z: null
            })
            point2 = {
                id: pointCounter,
                x: line.coord2[0],
                y: line.coord2[1],
                z: null
            }
            pointCounter++;
        } else {
            point2 = point2[1];
        }
        lines.push({
            id: lineCounter,
            startNode: point.id,
            endNode: point2.id,
            length: Math.sqrt(Math.pow(Math.abs(point.x - point2.x), 2) + Math.pow(Math.abs(point.y - point2.y), 2))
        })
        lineCounter++;
    })

    console.log(({
        points: points,
        lines: lines
    }))

    // console.log(shapeInformation)

}).catch(err => {
    console.log('\nAn error occured!\n');
    console.error(err.stack);
})

