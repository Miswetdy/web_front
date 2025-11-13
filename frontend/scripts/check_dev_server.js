const http = require('http');
http.get('http://localhost:3002/', res=>{
  console.log('status', res.statusCode);
  let out='';
  res.on('data', d=>out+=d.toString());
  res.on('end', ()=>{
    console.log('body starts:', out.slice(0,2000));
  });
}).on('error', e=>console.error('err', e.message));
