import gulp from 'gulp';
const { series, parallel } = gulp;
import { Transform } from 'stream';
import asyncDone from 'async-done';
import child_process from 'child_process';
import { TaskFunction } from 'undertaker';

function isThenable<T>(obj: any): obj is PromiseLike<T> {
    return (
        obj !== null &&
        typeof obj === "object" &&
        typeof obj.then === "function"
    );
}

export function makePromise<T>(obj: PromiseLike<T> | asyncDone.AsyncTask<T>) {
    if (isThenable(obj)) {
        return obj; // Already a then-able, just return
    }
    return new Promise((resolve, reject) => {
        asyncDone(obj, (err, result) => {
            err ? reject(err) : resolve(result)
        })
    });
}

export function runParallel(...tasks: TaskFunction[]) {
    return makePromise(parallel(...tasks));
}

export function runSeries(...tasks: TaskFunction[]) {
    return makePromise(series(...tasks));
}

export function execTask(command: string, options = {}) {
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

export function contentTransform(fn: (contents: any, file: any, enc: BufferEncoding) => any) {
    return new Transform({
        objectMode: true,
        transform(file: any, enc: BufferEncoding, cb): void {
            file.contents = Buffer.from(fn(file.contents, file, enc));
            cb(null, file);
        }
    });
}
