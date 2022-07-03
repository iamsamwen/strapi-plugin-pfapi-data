'use strict';

const os = require('os');
const fs = require('fs-extra');
const unzipper = require('unzipper');
const node_path = require('path');
const axios = require('axios');
const get_config_entity = require('./get-config-entity');

module.exports = async (strapi) => {

    const tmpdir = node_path.join(os.tmpdir(), 'pfapi-data');

    const project_root = strapi.dirs.root;
    const api_path = node_path.join(project_root, 'src', 'api');
    const world_city_api_path = node_path.join(api_path, 'world-city');

    if (!fs.existsSync(world_city_api_path)) {

        console.log('api not exists', world_city_api_path);
        const src_filepath = node_path.join(__dirname, 'world-city.zip');
        await unzip(src_filepath, tmpdir);
        await fs.move(node_path.join(tmpdir, 'world-city'), node_path.join(api_path, 'world-city'));

    } else {
        
        console.log('api exists', world_city_api_path);
    }
    
    const uid = 'api::world-city.world-city';

    if (!strapi.contentTypes[uid]) {

        if (fs.existsSync(tmpdir)) {
            await fs.rm(tmpdir, {recursive: true});
        }

        return;
    }

    if (await strapi.db.query(uid).count() == 0) {

        const des_filepath = node_path.join(tmpdir, 'world-cities.json');
        if (fs.existsSync(des_filepath)) {
            await fs.unlinkSync(des_filepath);
        }

        if (!fs.existsSync(tmpdir)) {
            fs.mkdirSync(tmpdir, {recursive: true});
        }

        const src_filepath = node_path.join(__dirname, 'world-cities.json.zip');
        await unzip(src_filepath, tmpdir);

        if (!fs.existsSync(des_filepath)) {
            console.log(`unzipped file ${des_filepath} not found`);
            return;
        }

        const world_cities = require(des_filepath);
        
        console.log('world_cities total', world_cities.length);

        const batch = 500;
        const entries = [];
        for (let i = 0; i < world_cities.length; i++) {
            entries.push(world_cities[i]);
            if (entries.length === batch) {
                await strapi.db.query(uid).createMany({data: entries});
                entries.length = 0;
            }
            if (i % 1000 === 0) process.stdout.write('.');
        }

        if (entries.length > 0) {
            await strapi.db.query(uid).createMany({data: entries});
            entries.length = 0;
            process.stdout.write('.');
        }

        console.log('\nworld cities upload done!');

        if (fs.existsSync(tmpdir)) {
            await fs.rm(tmpdir, {recursive: true});
        }
    }

    const handle_uid = 'plugin::pfapi.pfapi-handle';

    if (!strapi.contentTypes[handle_uid]) return;

    if (await strapi.db.query(handle_uid).count() > 0) return;

    const handle_filepath = node_path.join(tmpdir, 'handles.json');
    
    if (!fs.existsSync(handle_filepath)) {

        fs.mkdirSync(tmpdir, {recursive: true});

        if (!await download('https://s3.amazonaws.com/assets.jbtns.com/pfapi/handles.json', handle_filepath)) {
            console.log('failed to download handles.json');
            return;
        }
    }

    const handles = require(handle_filepath);

    for (const handle of handles) {
        const data = get_config_entity(handle);
        data.publishedAt = new Date();
        await strapi.entityService.create(handle_uid, {data});
    }

    console.log(`uploaded ${handles.length} handles`);

    if (fs.existsSync(tmpdir)) {
        await fs.rm(tmpdir, {recursive: true});
    }
}

async function download(url, local_filepath) {
    try {
        const response = await axios({method: 'GET', url, responseType: 'stream'});

        const pipe = response.data.pipe(fs.createWriteStream(local_filepath));

        return await new Promise(resolve => {
            pipe.on('finish', () => {
                resolve(true);
            });
            pipe.on('error', err => {
                console.error(err);
                resolve(false);
            });
        });
    } catch (err) {
      console.error(err);
      return null;
    }
}

function unzip(src_filepath, des_path) {
    return fs.createReadStream(src_filepath).pipe(unzipper.Parse())
        .on('entry', (entry) => {
            const filepath = `${des_path}/${entry.path}`;
            if (!filepath.endsWith(node_path.sep)) {
                const writeStream = fs.createWriteStream(filepath);
                return entry.pipe(writeStream);
            } else if (!fs.existsSync(filepath)) {
                fs.mkdirSync(filepath, {recursive: true});
            }
        }).promise();
}