import { assemble } from './src/core/assembler';

const code = `; bubblesort.asm example
count: SET 10
start: SET 0x100
    ldc start
    a2sp
    ldc count
loop:
    ldc 0
    brz loop
HALT`;

console.log(JSON.stringify(assemble(code), null, 2));
