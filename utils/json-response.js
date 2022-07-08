'use strict';

module.exports = function(res, status, error, payload) {
	res.status(status).send(JSON.stringify({
		error: error,
		payload: payload,
		status: status
	}));
};
