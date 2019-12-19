const { authorizeWithGithub } = require('../lib')
const fetch = require('node-fetch')

module.exports = {
    async addFakeUsers (root, { count }, { db }) {
        var randomUserApi = `https://randomuser.me/api/?results=${count}`

        var { results } = await fetch(randomUserApi).then(res => res.json())

        var users = results.map(r => ({
            githubLogin: r.login.username,
            name: `${r.name.first} ${r.name.last}`,
            avatar: r.picture.thumbnail,
            githubToken: r.login.sha1
        }))

        await db.collection('users').insertMany(users)

        return users
    },

    async fakeUserAuth (parent, { githubLogin }, { db }) {
        var user = await db.collection('users').findOne({ githubLogin })

        if (!user) {
            throw new Error(`Cannot find user with githubLogin "${githubLogin}"`)
        }

        return {
            token: user.githubToken,
            user
        }
    },

    async postPhoto (parent, args, { db, currentUser }) {
        if (!currentUser) {
            throw new Error("only an authorized user can post a photo")
        }
        
        var newPhoto = {
            ...args.input,
            userID: currentUser.githubLogin,
            created: new Date()
        }
        
        const { insertedId } = await db.collection("photos").insertOne(newPhoto)
        newPhoto.id = insertedId
        
        return newPhoto
    },

    async githubAuth (parent, { code }, { db }) {
        let {
            message,
            access_token,
            avatar_url,
            login,
            name
        } = await authorizeWithGithub({
            client_id: 'a155fd58fe8a94cccd10',
            client_secret: 'c11bec886aa9d59e58f9d2a13f2ba635ebbe3662',
            code
        })
    
        if (message) {
            throw new Error(message)
        }
    
        let latesUserInfo = {
            name,
            githubLogin: login,
            githubToken: access_token,
            avatar: avatar_url
        }
    
        const {
            ops: [user]
        } = await db
            .collection("users")
            .replaceOne({ githubLogin: login }, latesUserInfo, { upsert: true })
    
        return { user, token: access_token }
    }
}