import {mkdir, cp, copyFile} from 'node:fs/promises';
await mkdir('dist', {recursive:true});
for (const file of ['index.html','admin.html','.nojekyll']) await copyFile(file, 'dist/' + file);
await cp('assets', 'dist/assets', {recursive:true});
console.log('Site static pregătit în dist/. index.html rămâne în rădăcina proiectului.');
