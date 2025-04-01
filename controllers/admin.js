const {response,request, json } = require('express')






const getStatus = async (req=request, res = response) =>{

    res.json({
        status: 'ok',
        uptime: process.uptime
    })


}



module.exports = {

getStatus

}