const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');
const csv = require('csvtojson');
const pathToLineFile = path.join(__dirname, 'RawInput/shapey.shp');
const pathToPointFile = path.join(__dirname, 'RawInput/points.csv');
const toleranceValue = 0.01;

function round(value) {
    return Number(value.toFixed(4));
}
let get = (function() {
    let pipeIdCount = 0;
    let nodeIdCount = 0;
    return {
        length: function(point1, point2) {
            return round(Math.sqrt(Math.pow(Math.abs(point1.x - point2.x), 2) + Math.pow(Math.abs(point1.y - point2.y), 2)));
        },
        pipeId: function() {
            return pipeIdCount++;
        },
        nodeId: function() {
            return nodeIdCount++;
        }
    }
})();
let load = {
    shapeFile : async function(shapeFilePath) {
        let output = [];
        let points = {};
        let lines = {};
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
            feature.geometry.coordinates.forEach((point, i) => {
                if (i === feature.geometry.coordinates.length-1) return;
                if (i === 0) { //If it's the first element, create two so that the first line can join to something.
                    points[get.nodeId()] = {
                        x: round(point[0]),
                        y: round(point[1])
                    }
                }

                points[get.nodeId()] = {
                    x: round(feature.geometry.coordinates[i + 1][0]),
                    y: round(feature.geometry.coordinates[i + 1][1])
                }
            }
        })
        return output;
    },
    pointFile : async function(pointFilePath) {
        return csv({
            noheader: true,
            trim: true,
            delimiter:[","],
            output:"csv"
        })
            .fromFile(pathToInput)
            .then(data => {
                return {
                    x: data[0],
                    y: data[1],
                    z: data[2]
                }
            });
    }
}


function loadPipeNetworks(networkArray) {
    networkArray.forEach(network => {
        let { shapefilePath, pointFilePath, forcedPointsPath, options } = network;
        let { checkInternalCollisions, checkGlobalCollisions, pipeDia } = options;

        


    })
}
