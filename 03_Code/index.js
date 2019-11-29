const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');
const pathToInput = path.join(__dirname, 'RawInput/shapey.shp');

async function getShapeFile(path) {
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
}

function solveLineCollisions(lineInformation) {
    console.log(lineInformation)
    let outputCollisions;
    // let remaining = lineInformation;
    // lineInformation.forEach((line, i) => {
    //     remaining.forEach((secondLine, x) => {

    //     })
    //     //remove item from remaining
    // });
};


console.log('BlueBarn Parser Tool Started.');

let outputFile = {
    junctions : [],
    pipes : [],
    coordinates : [],
    vertices : []
}

/* EXPECTED SCHEMA
    Junction : id, elev, demand (0), pattern (empty).
    Pipe : id, node1, node2, length, diameter, roughness (100), minorloss (0), status (open)
    coordinates : node, x-coord, y-coord
    vertices : link [which pipe], x-coord, y-coord
*/
let nodeCounter = 0;
let pipeCounter = 0;
function getNode() {
    return nodeCounter++;
}
function getPipe() {
    return pipeCounter++
}

getShapeFile(pathToInput).then(shapefile => {
    let rawLineInformation = [];
    shapefile.forEach(feature => {
        if (feature.type !== 'Feature') throw new Error('Unrecognised feature type of: ' + feature.type);
        if (feature.geometry.type !== 'LineString') throw new Error('Unrecognised feature type of: ' + feature.geometry.type);
        let vertCounter = 0;
        let pipeNo = getPipe();
        for (let i = 0; i<feature.geometry.coordinates.length; i++) {
            let coord1 = feature.geometry.coordinates[i];
            let coord2 = feature.geometry.coordinates[i+1];
            // if (i >= 2) {
            //     coord2 = JSON.parse(JSON.stringify(coord1));
            //     coord1 = feature.geometry.coordinates[i-1];
            // }
            rawLineInformation.push({
                coord1: coord1,
                coord2: coord2,
                pipeNo: pipeNo,
                vertNo: vertCounter,
                totalVerts: feature.geometry.coordinates.length
            });
            vertCounter++;
        };
    });
    solveLineCollisions(rawLineInformation);

}).catch(err => {
    console.log('\nAn error occured!\n');
    console.error(err.stack);
})