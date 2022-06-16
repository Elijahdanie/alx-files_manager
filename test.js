let file = "hey check"
let b64 = Buffer.from(file).toString('base64');
console.log(b64);
let decoded = Buffer.from(b64, 'base64').toString('utf-8');
console.log(decoded)
