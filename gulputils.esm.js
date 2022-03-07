import { series, parallel } from 'gulp';
import { Transform } from 'stream';
import asyncDone from 'async-done';

function makePromise(obj) {
    if (obj.then instanceof Function) {
        return obj; // Already a then-able, just return
    }
    return new Promise((resolve, reject) => {
        asyncDone(obj, (err, result) => {
            err ? reject(err) : resolve(result)
        })
    });
}

function runParallel(...tasks) {
    return makePromise(parallel(...tasks));
}

function runSeries(...tasks) {
    return makePromise(series(...tasks));
}

function contentTransform(fn) {
    return new Transform({
        objectMode: true,
        transform(file, enc, cb) {
            file.contents = Buffer.from(fn(file.contents, file, enc));
            cb(null, file);
        }
    });
}

export {
    makePromise,
    runParallel,
    runSeries,
    contentTransform,
}
