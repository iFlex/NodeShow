cp /tmp/nodeshow.tar ./
tar -xvf nodeshow.tar
rm -rf ./client
rm -rf ./server
cp -r ./dist/client ./client
cp -r ./dist/server ./server
cd server
/root/.nvm/versions/node/v17.1.0/bin/npm install
cd ..
rm nodeshow.tar
rm -rf dist
service nodeshow restart
rm /tmp/nodeshow.tar
