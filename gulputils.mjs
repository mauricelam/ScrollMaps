import gulp from 'gulp';
const { series, parallel } = gulp;
import { Transform } from 'stream';
import asyncDone from 'async-done';
import child_process from 'child_process';

export function makePromise(obj) {
    if (obj.then instanceof Function) {
        return obj; // Already a then-able, just return
    }
    return new Promise((resolve, reject) => {
        asyncDone(obj, (err, result) => {
            err ? reject(err) : resolve(result)
        })
    });
}

export function runParallel(...tasks) {
    return makePromise(parallel(...tasks));
}

export function runSeries(...tasks) {
    return makePromise(series(...tasks));
}

export function execTask(command, options = {}) {
    const task = async () =>
        new Promise((resolve, reject) => {
            child_process.exec(command, options, (err, stdout, stderr) => {
                if (stdout) console.log(`${command}: ${stdout.trim()}`);
                if (stderr) console.warn(`${command}: ${stderr.trim()}`);
                err ? reject(err) : resolve(stdout);
            });
        });
    task.displayName = `Exec \`${command}\``;
    return task;
}

export function contentTransform(fn) {
    return new Transform({
        objectMode: true,
        transform(file, enc, cb) {
            file.contents = Buffer.from(fn(file.contents, file, enc));
            cb(null, file);
        }
    });
}
