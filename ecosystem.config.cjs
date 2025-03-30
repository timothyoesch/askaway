module.exports = {
    apps: [
        {
            name: 'askaway',
            port: '8090',
            exec_mode: 'cluster',
            instances: '2',
            script: './.output/server/index.mjs'
        }
    ]
}