import { resolve } from 'node:path';
import { openStore } from './database.mjs';
import { createApp } from './app.mjs';
const port=Number(process.env.PORT || 3001);
if(!Number.isInteger(port)||port<1||port>65535) throw Error('Invalid PORT.');
const store=openStore(resolve(process.env.PAISA_DB || 'data/paisa.sqlite'));
const server=createApp(store);
server.listen(port,'127.0.0.1',()=>console.log(`Paisa: http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>{store.close();process.exit(0);}));
