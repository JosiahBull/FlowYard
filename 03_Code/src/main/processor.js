const fs = require('fs');
const shapefile = require('shapefile');
const csv = require('csvtojson');
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
        },
        reset: function() {
            counterValue = 0;
        }
    }
});
const pipeId = new Counter;
const nodeId = new Counter;
//Helper Functions
function round(value) {
    return Number(Number(value).toFixed(4));
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
        Object.keys(input).forEach(subObj => {
            output.push({
                ...input[subObj],
                id: Number(subObj)
            })
        })
    }
    return output;
};
function duplicatePoint(checkPoint, points) {
    let filteredPoints = points.filter(point => point.x === checkPoint.x && point.y === checkPoint.y);
    return (filteredPoints.length > 0) ? {value: true, point: filteredPoints[0]} : {value: false, point: checkPoint};
};
//Main Functions
let get = (function() {
    function quickSort(lineGroup) {
        return lineGroup.sort((a, b) => {
            if (a.endNode === b.startNode) return -1;
            if (b.endNode === a.startNode) return 1;
            return 0;
        });
    };
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
                newPoint.point.id = nodeId.getCurrent();
                points[nodeId.increment()] = newPoint.point;
            }
            newPoint = newPoint.point;
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
        let groupedCollisions = {};
        collisions.forEach(collision => {
            if (collision.line.id in groupedCollisions) {
                groupedCollisions[collision.line.id].push(collision);
            } else {
                groupedCollisions[collision.line.id] = [collision];
            }
        });
        groupedCollisions = Object.values(groupedCollisions).map(collisionGroup => collisionGroup.sort((a, b) => { //Ensure collisions are ordered from closest to furthest away
            let aDist = this.length(points[a.line.startNode], a.point);
            let bDist = this.length(points[b.line.startNode], b.point);
            if (aDist > bDist) return 1;
            if (bDist > aDist) return -1;
            return 0;
        }));
        groupedCollisions.forEach(collisionGroup => {
            lines[collisionGroup[0].line.id].endNode = collisionGroup[0].point.id;
            lines[collisionGroup[0].line.id].length = this.length(points[lines[collisionGroup[0].line.id].startNode], points[collisionGroup[0].point.id]);
            collisionGroup.forEach((collision, i) => {
                //Only three collisions, but requires four lines changes/additions - Rewrite Function.
                if (i === collisionGroup.length - 1) {  
                    lines[pipeId.increment()] = {
                        startNode: collision.point.id,
                        endNode: collision.line.endNode,
                        length: this.length(points[collision.point.id], points[collision.line.endNode]),
                        lineId: collision.line.lineId
                    };
                    return;
                }
                lines[pipeId.increment()] = {
                    startNode: collision.point.id,
                    endNode: collisionGroup[i+1].point.id,
                    length: this.length(points[collision.point.id], points[collisionGroup[i+1].point.id]),
                    lineId: collision.line.lineId
                };
            });
        });
        return {
            lines: lines,
            points: points
        }
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
        return (line2StartNode === undefined && line2EndNode === undefined) ? 
        {
            min: Math.min(line1StartNode.x, line1EndNode.x),
            max: Math.max(line1StartNode.x, line1EndNode.x)
        } : {
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
                    if (xCollision >= xOverlap.min && xCollision <= xOverlap) {
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
            let collisionCounter = new Counter;
            let collisions = [];
            changeState(lines).forEach(line => {
                line.equation = lineEquation(points[line.startNode], points[line.endNode]);
                changeState(points).forEach(point => {
                    if (point.id === line.startNode || point.id === line.endNode) return; //If this point is at the start or end of this line, return.
                    let extent = lineExtents(points[line.startNode], points[line.endNode]);
                    if ((point.x >= extent.min && point.x < extent.max) || (line.equation.isVertical && line.equation.grad === point.x)) { //Does the x of the point fall within the range of the line.
                        if (Math.abs((line.equation.grad * point.x + line.equation.yInt) - point.y) < toleranceValue || line.equation.isVertical) { //Does the y of the point match with the calculated value of the lines y at the point's x.
                            collisions.push({
                                id: collisionCounter.increment(),
                                line: line,
                                point: point,
                                xCollision: point.x
                            });
                        }
                    };
                });
            });
            return resolvePointCollisions.call(this, lines, points, collisions);
        },
        addZDimension: function(points, replacePoints) {
            return changeState(points.map(point => {                
                let checkPoint = duplicatePoint(point, replacePoints, true);
                if (checkPoint.value) {
                    point.z = checkPoint.point.z;
                } else {
                    point.z = 0;
                }
                return point;
            }));
        },
        addPipeDiameter: function(pipes, diameter) {
            return changeState(pipes).map(pipe => {
                pipe.diameter = diameter;
                return pipe;
            });
        },
        verticies: function(lines, points) {
            function verifyLineGroup(lineGroup) {
                let valid = true;
                let index, newLineGroups;
                lineGroup.forEach((line, i) => {
                    if (i === lineGroup.length-1) return;
                    if (line.endNode !== lineGroup[i+1].startNode) {
                        valid = false;
                        index = i;
                        newLineGroups = [lineGroup.slice(0, i+1), lineGroup.slice(i+1, lineGroup.length)]
                    };
                });
                return {
                    lineGroup: lineGroup,
                    valid: valid,
                    index: index,
                    newLineGroups: newLineGroups
                }
            };
            let verticies = {};
            let linesByPoint = changeState(lines).reduce((linesByPoint, line) => {
                if (line.startNode in linesByPoint) {
                    linesByPoint[line.startNode].push(line);
                } else {
                    linesByPoint[line.startNode] = [line];
                }
                if (line.endNode in linesByPoint) {
                    linesByPoint[line.endNode].push(line);
                } else {
                    linesByPoint[line.endNode] = [line];
                }
                return linesByPoint
            }, {});
            let linesByLineId = changeState(lines).reduce((linesByLineId, line) => {
                if (line.lineId in linesByLineId) {
                    linesByLineId[line.lineId].push(line);
                } else {
                    linesByLineId[line.lineId] = [line];
                }
                return linesByLineId;
            }, {});

            let groupedLinesByPoint = Object.values(linesByLineId)
            .map(lineGroup => quickSort(lineGroup)) //Order linegroups to ensure all things are happy for following steps.
            .filter(lineGroup => {
                if (lineGroup.length === 1) return false; //Remove any lineGroups that only have a singular line in them, they will not have veritices.
                if (lineGroup.filter((line, i) => (linesByPoint[line.startNode].length > 2 && i !== 0) || (linesByPoint[line.endNode].length > 2) && i !== lineGroup.length-1).length !== 0) return false;//Check that all points except for first and last do not have more connections. If they do then this linegroup must be discarded.
                return true;
            }).reduce((acc, lineGroup) => {
                let boi = verifyLineGroup(lineGroup);
                // if (!boi.valid) {
                    // console.log(boi)
                // }

                acc.push(lineGroup)
                return acc;
            }, []);

            
            groupedLinesByPoint.forEach(lineGroup => {
                lines[lineGroup[0].id].endNode = lineGroup[lineGroup.length-1].endNode; //Update endNode of line.
                lines[lineGroup[0].id].length = round(lineGroup.reduce((a, b) => a + (b.length || 0), 0)); //Update length of line.
                lineGroup.forEach((line, i) => {
                    if (i === lineGroup.length-1) {
                        delete lines[line.id];
                        return;
                    }; //Don't check the final item in this array, as the endNode of it is the new final endNode.
                    points[line.endNode].lineId = lineGroup[0].id;
                    verticies[line.endNode] = points[line.endNode];
                    delete points[line.endNode];
                    if (i === 0) return; //Don't delete the first item Id, as it is the line we want to keep.
                    delete lines[line.id];
                })
            }); //Figure out the new points.
            return {
                lines: lines,
                points: points,
                verticies: verticies
            }
        },
        length: function(point1, point2) {
            return round(Math.sqrt(Math.pow(Math.abs(point1.x - point2.x), 2) + Math.pow(Math.abs(point1.y - point2.y), 2)));
        },
        saveFile : function(lines, points, verticies) {
            points = changeState(points);
            let saveFile = '[TITLE]\nbluebarn\n\n[JUNCTIONS]\n;ID              	Elev        	Demand      c	Pattern         \n';
            points.forEach(junction => {
                saveFile += ` ${junction.id}              	${junction.z}           	0           	                	;\n`;
            });
            saveFile += '\n[PIPES]\n;ID              	Node1           	Node2           	Length      	Diameter    	Roughness   	MinorLoss   	Status\n';
            changeState(lines).forEach(pipe => {
                saveFile += ` ${pipe.id}              	${pipe.startNode}              	${pipe.endNode}              	${pipe.length}          	${pipe.diameter}          	100         	0           	Open  	;\n`;
            });
            saveFile += '\n[COORDINATES]\n;Node            	X-Coord         	Y-Coord\n';
            points.forEach(coordinate => {
                saveFile += ` ${coordinate.id}              	${coordinate.x}              	${coordinate.y}\n`;
            });
            saveFile +='\n[VERTICES]\n'
            verticies = changeState(verticies).forEach(vertex => {
                saveFile += ` ${vertex.lineId}              	${vertex.x}              	${vertex.y}\n`
            });
            saveFile += '\n[END]\n';
            return saveFile;
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
            let i = 0;
            feature.geometry.coordinates.forEach(point => {
                if (i === feature.geometry.coordinates.length-1) return;
                if (i === 0) { //If it's the first element, create two so that the first line can join to something.
                    let firstPoint = duplicatePoint({
                        x: round(point[0]),
                        y: round(point[1])
                    }, changeState(points));
                    if (!firstPoint.value) {
                        lastPointId = nodeId.increment();
                        points[lastPointId] = firstPoint.point;
                    } else {
                        lastPointId = firstPoint.point.id
                    }
                }
                let secondPoint = duplicatePoint({
                    x: round(feature.geometry.coordinates[i + 1][0]),
                    y: round(feature.geometry.coordinates[i + 1][1])
                }, changeState(points));
                if (!secondPoint.value) {
                    pointId = nodeId.increment();
                    points[pointId] = secondPoint.point;
                } else {
                    pointId = secondPoint.point.id;
                }
                lines[pipeId.increment()] = {
                    startNode: lastPointId,
                    endNode: pointId,
                    length: get.length(points[pointId], points[lastPointId]),
                    lineId: lineId
                };
                lastPointId = pointId;
                i++;
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
                return data.map(point => {
                    return {
                        x: round(point[0]),
                        y: round(point[1]),
                        z: round(point[2])
                    }
                })
            });
    }
};
export default function(pipeNetworkArr, globalOptions) {
    let { simplifyVerticies, checkGlobalCollisions, removeDuplicates } = globalOptions;
    pipeId.reset();
    nodeId.reset();
    let output = {
        lines: {},
        points: {},
        verticies: {}
    };
    return Promise.all(pipeNetworkArr.map(network => {
        let { shapeFile, pointFile, checkInternalCollisions, diameter } = network;
        return load.shapeFile(shapeFile).then(shapeFile => {
            if (checkInternalCollisions) {
                return get.pointCollisions(shapeFile.lines, shapeFile.points).then(result => {
                    return get.lineCollisions(result.lines, result.points);
                })
            }
            return shapeFile;
        }).then(result => {
            if (pointFile !== '') {
                return load.pointFile(pointFile).then(replacePoints => {
                    return {
                        points: get.addZDimension(changeState(result.points), replacePoints),
                        verticies: result.verticies,
                        lines: get.addPipeDiameter(result.lines, diameter)
                    }
                });
            }
            return result;
        }).then(result => {
            output.lines = {...output.lines, ...result.lines};
            output.points = {...output.points, ...result.points};
            return result;
        })
    })).then(() => {
        if (removeDuplicates) {
            //TODO
        }
        return output;
    }).then(result => {
        if (checkGlobalCollisions) {
            return get.pointCollisions(result.lines, result.points).then(result => {
                return get.lineCollisions(result.lines, result.points)
            });
        }
        return result;
    }).then(result => {
        if (simplifyVerticies) {
            return get.verticies(result.lines, result.points);
        }
        return result
    }).then(result => {
        fs.writeFileSync('test.inp', get.saveFile(result.lines, result.points, result.verticies))
        return {
            raw: result,
            saveFile: get.saveFile(result.lines, result.points, result.verticies)
        }
    }).catch(err => {
        console.log(err);
    });
};