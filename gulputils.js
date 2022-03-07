const {series, parallel} = require('gulp');
const Transform = require('stream').Transform;
const asyncDone = require('async-done');
const child_process = require('child_process');

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

function execTask(command, options = {}) {
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

function contentTransform(fn) {
    return new Transform({
        objectMode: true,
        transform(file, enc, cb) {
            file.contents = Buffer.from(fn(file.contents, file, enc));
            cb(null, file);
        }
    });
}

module.exports = {
    makePromise: makePromise,
    runParallel: runParallel,
    runSeries: runSeries,
    contentTransform: contentTransform,
    execTask: execTask,
};
