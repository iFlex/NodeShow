#Setup
rm -rf ./out
rm -rf ./dist
mkdir ./dist
mkdir ./dist/server
mkdir ./dist/client
mkdir ./out
cd ./dist

#Copy
cp -r ../client/* ./client
cp -r ../server/* ./server
rm -rf ./server/node_modules

#Zip
cd ..
tar -czvf ./out/nodeshow.tar ./dist 
