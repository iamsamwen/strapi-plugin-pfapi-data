'use strict';

const os = require('os');
const fs = require('fs-extra');
const unzipper = require('unzipper');
const node_path = require('path');

module.exports = async (strapi) => {

    const tmpdir = node_path.join(os.tmpdir(), 'pfapi-data');
    const project_root = get_project_root();
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

    if (!has_uid(strapi, uid)) {

        if (fs.existsSync(tmpdir)) {
            await fs.rm(tmpdir, {recursive: true});
        }

        return;
    }

    if (await strapi.query(uid).count() == 0) {

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

        let i = 0;
        const batch = 500;
        const entries = [];

        while (world_cities.length > 0) {

            const entry = world_cities.pop();
            entry.published_at = new Date();

            entries.push(entry);

            if (entries.length === batch) {
                await strapi.query(uid).createMany({data: entries});
                entries.length = 0;
            }

            if (i++ % 1000 === 0) process.stdout.write('.');
        }

        if (entries.length > 0) {
            await strapi.query(uid).createMany({data: entries});
            process.stdout.write('.');
        }

        console.log('\nworld cities upload done!');

        if (fs.existsSync(tmpdir)) {
            await fs.rm(tmpdir, {recursive: true});
        }
    }

    const handle_uid = 'plugin::pfapi.pfapi-handle';

    if (!has_uid(strapi, handle_uid)) return;

    if (await strapi.query(handle_uid).count() > 0) return;

    const handle_filepath = node_path.join(__dirname, 'handles.json');
    
    const handles = require(handle_filepath);

    await strapi.query(handle_uid).createMany({data: handles});

    console.log(`uploaded ${handles.length} handles`);
}

function get_project_root() {

    const strapi_bin_path = '/node_modules/@strapi/strapi/bin';
    const main_path = node_path.dirname(require.main.filename);

    if (!main_path.endsWith(strapi_bin_path)) {
        throw new Error('failed to get project root');
    }

    return main_path.slice(0, main_path.length - strapi_bin_path.length);
}

function has_uid(strapi, uid) {
    for (const [key, ] of Object.entries(strapi.contentTypes)) {
        if (key === uid) {
            return true;
        }
    }
    return false;
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