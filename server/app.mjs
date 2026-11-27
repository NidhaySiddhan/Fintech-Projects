import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { ConflictError } from './database.mjs';

const LIMIT=10*1024*1024;
export function createApp(store, {dist=resolve('dist'), devOrigin='http://127.0.0.1:5173'}={}) {
  return createServer(async (req,res) => {
    const json=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
    try {
      const host=req.headers.host || '';
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return json(403,{error:'Local access only.'});
      const origin=req.headers.origin;
      if (origin && origin!==`http://${host}` && origin!==devOrigin && origin!=='http://localhost:5173') return json(403,{error:'Origin not allowed.'});
      const url=new URL(req.url,`http://${host}`);
      if(url.pathname==='/api/workspace') {
        if(req.method==='GET') return json(200,store.read());
        if(req.method!=='PUT') return json(405,{error:'Method not allowed.'});
        if(req.headers['content-type']?.split(';')[0]!=='application/json') return json(415,{error:'Send application/json.'});
        const chunks=[];let size=0;
        for await(const chunk of req) {size+=chunk.length;if(size>LIMIT) return json(413,{error:'Backup must be under 10 MB.'});chunks.push(chunk);}
        let body;
        try {body=JSON.parse(Buffer.concat(chunks).toString());}
        catch {return json(400,{error:'Invalid JSON.'});}
        try {return json(200,store.save(body?.data,body?.revision));}
        catch(e) {return json(e instanceof ConflictError ? 409 : 400,{error:e instanceof ConflictError ? e.message : 'Invalid data or save failed. No records were changed.'});}
      }
      if(url.pathname.startsWith('/api/')) return json(404,{error:'Not found.'});
      if(req.method!=='GET' && req.method!=='HEAD') return json(405,{error:'Method not allowed.'});
      const pathname=decodeURIComponent(url.pathname);
      const file=resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));
      if(!file.startsWith(resolve(dist)+sep)) return json(403,{error:'Not allowed.'});
      const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.ico':'image/x-icon'};
      if(!types[extname(file)]) return json(404,{error:'Not found.'});
      try {const content=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)],'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);}
      catch {return json(404,{error:'File not found. Run npm run build first.'});}
    } catch { if(!res.headersSent) json(500,{error:'Server error. Your saved data has not been reset.'});else res.end(); }
  });
}
