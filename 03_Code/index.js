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

console.log('BlueBarn Parser Tool Started.');

let inpOutPutFile = {
    junctions : [],
    pips : [],
    coordinates : [],
    vertices : []
}

/* EXPECTED SCHEMA
    Junction : id, elev, demand (0), pattern (empty).
    Pipe : id, node1, node2, length, diameter, roughness (100), minorloss (0), status (open)
    coordinates : node, x-coord, y-coord
    vertices : link [which pipe], x-coord, y-coord
*/

getShapeFile(pathToInput).then(shapefile => {
    shapefile.forEach(feature => {
        console.log(JSON.stringify(feature))
        if (feature.type !== 'Feature') throw new Error('Unrecognised fetaure type of: ' + feature.type);
        if (feature.geometry.type !== 'LineString') throw new Error('Unrecognised feature type of: ' + feature.geometry.type);

        

    })


}).catch(err => {
    console.log('\nAn error occured!\n');
    console.error(err.stack);
})