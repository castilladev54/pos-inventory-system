const fs = require('fs');
const path = require('path');
const dir = './tests';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
files.forEach(f => {
  const p = path.join(dir, f);
  let c = fs.readFileSync(p, 'utf8');
  let replaced = false;
  if (c.includes('.set(authHeaders)')) {
    c = c.replace(/\.set\(authHeaders\)/g, ".set({ ...authHeaders, 'x-branch-id': branchId.toString() })");
    replaced = true;
  }
  if (replaced) {
    fs.writeFileSync(p, c);
    console.log('Fixed auth headers in ' + f);
  }
});
