const http = require('http');
http.get('http://localhost:3002/static/js/bundle.js', res => {
  let out = '';
  res.on('data', d => out += d.toString());
  res.on('end', () => {
    console.log('entryLoaded', out.indexOf('Entry loaded'));
    console.log('appRender', out.indexOf('YearDeterminationApp render'));
    console.log('inlineIndex', out.indexOf('inline index script executed'));
  });
}).on('error', e => console.error('err', e.message));
