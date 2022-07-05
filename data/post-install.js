'use strict';

const fs = require('fs-extra');
const node_path = require('path');
const unzip = require('./unzip');

(async () => {

    let root;
    
    let path = __dirname;
    let index = path.indexOf('node_modules');
    if (index !== -1) {
        root = path.slice(0, index - 1);
    } else {
        path = require.main.filename;
        index = path.indexOf('node_modules');
        if (index !== -1) {
            root = path.slice(0, index - 1);
        } else {
            const data_path = '/src/plugins/pfapi-data/data';
            if (__dirname.endsWith(data_path)) {
                root = __dirname.slice(0, __dirname.length - data_path.length);
            } else {
                console.log('strapi project root not found');
                return;
            }
        }
    }
    
    if (!fs.existsSync(node_path.join(root, 'src', 'admin'))) {
        console.log('not a strapi project root');
        return;
    }
    if (!fs.existsSync(node_path.join(root, 'src', 'api'))) {
        console.log('not a strapi project root');
        return;
    }

    const world_city_path = node_path.join(root, 'src', 'api', 'world-city');

    if (!fs.existsSync(world_city_path)) {
        await fs.copy(node_path.join(__dirname, 'world-city'), world_city_path);
        console.log('installed world-city api');
    }

    const uploads_pfapi_path = node_path.join(root, 'public', 'uploads', 'pfapi');

    if (!fs.existsSync(uploads_pfapi_path)) {
        const uploads_path = node_path.join(root, 'public', 'uploads');
        if (!fs.existsSync(uploads_path)) {
            fs.mkdirSync(uploads_path, {recursive: true});
        }
        const src_filepath = node_path.join(__dirname, 'pfapi.zip');
        await unzip(src_filepath, uploads_path);
        console.log('installed pfapi files');
    }
})();