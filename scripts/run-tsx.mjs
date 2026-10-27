import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
const require=createRequire(new URL('../apps/stand/package.json',import.meta.url));
const child=spawn(process.execPath,[require.resolve('tsx/cli'),...process.argv.slice(2)],{stdio:'inherit',env:process.env});
child.on('error',()=>{process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
