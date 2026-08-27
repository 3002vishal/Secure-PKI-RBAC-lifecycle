const { execFile } = require("child_process");
const path = require("path");

const exe = path.join(__dirname, "query_slot.exe");

console.log("Before execFile");

execFile(exe, ["2"], (err, stdout, stderr) => {
    console.log("Inside callback");

    console.log("err =", err);
    console.log("stdout =", JSON.stringify(stdout));
    console.log("stderr =", JSON.stringify(stderr));
});

console.log("After execFile");