const crypto = require('crypto');
const https = require('https');

const WTRL_AUTHORIZE_URL =
	'https://www.wtrl.racing/api3/authentication/zwiftgps';

const WTRL_EXCHANGE_URL =
	'https://www.wtrl.racing/api3/authentication/zwiftgps/exchange';

function base64Url(buffer) {
	return buffer.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

function exchangeWtrlCode(code, clientId, redirectUri, verifier) {
	const body = new URLSearchParams({
		code,
		client_id: clientId,
		redirect_uri: redirectUri,
		code_verifier: verifier
	}).toString();

	return new Promise((resolve, reject) => {
		const request = https.request(WTRL_EXCHANGE_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': Buffer.byteLength(body),
				'Accept': 'application/json'
			}
		}, response => {
			let text = '';
			let bytes = 0;

			response.setEncoding('utf8');

			response.on('data', chunk => {
				bytes += Buffer.byteLength(chunk);

				if (bytes > 65536) {
					response.destroy(new Error('WTRL response too large.'));
					return;
				}

				text += chunk;
			});

			response.on('error', reject);

			response.on('end', () => {
				if (response.statusCode !== 200) {
					reject(new Error(
						`WTRL sign-in exchange failed (${response.statusCode}).`
					));
					return;
				}

				try {
					const identity = JSON.parse(text);

					if (
						!Number.isSafeInteger(identity.userId) ||
						identity.userId <= 0 ||
						!Number.isSafeInteger(identity.zwid) ||
						identity.zwid <= 0 ||
						typeof identity.uuid !== 'string' ||
						!identity.uuid
					) {
						throw new Error('Invalid WTRL identity response.');
					}

					resolve(identity);
				} catch (error) {
					reject(error);
				}
			});
		});

		request.setTimeout(15000, () => {
			request.destroy(new Error('WTRL sign-in exchange timed out.'));
		});

		request.on('error', reject);
		request.end(body);
	});
}

function requestGpsStorage(payload) {
	const secret = process.env.WTRL_GPS_STORAGE_SECRET;

	if (!secret || !/^[a-f0-9]{64}$/.test(secret)) {
		return Promise.reject(
			new Error('WTRL GPS storage secret is missing or invalid.')
		);
	}

	const body = JSON.stringify(payload);

	return new Promise((resolve, reject) => {
		const request = https.request(
			'https://www.wtrl.racing/api3/authentication/zwiftgps/storage',
			{
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${secret}`,
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(body),
					'Accept': 'application/json'
				}
			},
			response => {
				let text = '';
				let bytes = 0;

				response.setEncoding('utf8');

				response.on('data', chunk => {
					bytes += Buffer.byteLength(chunk);

					if (bytes > 65536) {
						response.destroy(
							new Error('GPS storage response too large.')
						);
						return;
					}

					text += chunk;
				});

				response.on('error', reject);

				response.on('end', () => {
					if (response.statusCode !== 200) {
						reject(new Error(
							`GPS storage request failed (${response.statusCode}).`
						));
						return;
					}

					try {
						const result = JSON.parse(text);

						if (
							!result ||
							typeof result !== 'object' ||
							Array.isArray(result)
						) {
							throw new Error('Invalid GPS storage response.');
						}

						resolve(result);
					} catch (error) {
						reject(error);
					}
				});
			}
		);

		request.setTimeout(15000, () => {
			request.destroy(
				new Error('GPS storage request timed out.')
			);
		});

		request.on('error', reject);
		request.end(body);
	});
}

function registerWtrlAuth(app) {
	const clientId =
		process.env.WTRL_GPS_CLIENT_ID || 'zwiftgps-local';

	const redirectUri =
		process.env.WTRL_GPS_REDIRECT_URI ||
		'http://localhost:8080/auth/wtrl/callback';

	const frontendUrl =
		process.env.WTRL_GPS_FRONTEND_URL ||
		'http://localhost:8888/';

	const secureCookies = new URL(redirectUri).protocol === 'https:';

	function createStorage(kind) {
		return {
			async set(key, value) {
				const result = await requestGpsStorage({
					operation: 'put',
					kind,
					key,
					clientId,
					value
				});

				if (result.success !== true) {
					throw new Error('GPS storage write failed.');
				}
			},

			async get(key) {
				const result = await requestGpsStorage({
					operation: 'get',
					kind,
					key,
					clientId
				});

				return result.value;
			},

			async take(key) {
				const result = await requestGpsStorage({
					operation: 'take',
					kind,
					key,
					clientId
				});

				return result.value;
			},

			async del(key) {
				const result = await requestGpsStorage({
					operation: 'delete',
					kind,
					key,
					clientId
				});

				if (result.success !== true) {
					throw new Error('GPS storage deletion failed.');
				}
			}
		};
	}

	const pendingLogins = createStorage('pending');
	const sessions = createStorage('session');

	app.get('/auth/wtrl', async (req, res) => {
		res.set('Cache-Control', 'no-store');

		try {
			const state = crypto.randomBytes(32).toString('hex');
			const verifier = base64Url(crypto.randomBytes(32));
			const browserToken = crypto.randomBytes(32).toString('hex');

			const challenge = base64Url(
				crypto.createHash('sha256').update(verifier).digest()
			);

			await pendingLogins.set(browserToken, {
				state,
				verifier
			});

			res.cookie('wtrlGpsLogin', browserToken, {
				httpOnly: true,
				sameSite: 'lax',
				secure: secureCookies,
				path: '/auth/wtrl',
				maxAge: 600000
			});

			const destination = new URL(WTRL_AUTHORIZE_URL);

			destination.searchParams.set('client_id', clientId);
			destination.searchParams.set('redirect_uri', redirectUri);
			destination.searchParams.set('state', state);
			destination.searchParams.set('code_challenge', challenge);
			destination.searchParams.set('code_challenge_method', 'S256');

			res.redirect(destination.toString());
		} catch (error) {
			console.error('WTRL sign-in start failed:', error.message);

			res.status(502).send(
				'WTRL sign-in is temporarily unavailable. Please try again.'
			);
		}
	});

	app.get('/auth/wtrl/callback', async (req, res) => {
		res.set('Cache-Control', 'no-store');
		res.set('Referrer-Policy', 'no-referrer');

		const browserToken = req.cookies.wtrlGpsLogin;
		const state = req.query.state;
		const code = req.query.code;

		if (
			typeof browserToken !== 'string' ||
			!/^[a-f0-9]{64}$/.test(browserToken) ||
			typeof state !== 'string' ||
			!/^[a-f0-9]{64}$/.test(state) ||
			typeof code !== 'string' ||
			!/^[a-f0-9]{64}$/.test(code)
		) {
			res.status(400).send(
				'GPS sign-in is invalid or expired. Please start again.'
			);
			return;
		}

		try {
			const pending = await pendingLogins.get(browserToken);

			if (
				!pending ||
				pending.expiresAt <= Date.now() ||
				typeof pending.state !== 'string' ||
				!/^[a-f0-9]{64}$/.test(pending.state) ||
				!crypto.timingSafeEqual(
					Buffer.from(state, 'hex'),
					Buffer.from(pending.state, 'hex')
				)
			) {
				res.status(400).send(
					'GPS sign-in is invalid or expired. Please start again.'
				);
				return;
			}

			// Atomically consume the pending login before exchanging the code.
			const consumed = await pendingLogins.take(browserToken);

			if (
				!consumed ||
				consumed.expiresAt <= Date.now() ||
				consumed.state !== state ||
				typeof consumed.verifier !== 'string' ||
				!/^[A-Za-z0-9_-]{43}$/.test(consumed.verifier)
			) {
				res.status(400).send(
					'GPS sign-in is invalid or expired. Please start again.'
				);
				return;
			}

			res.clearCookie('wtrlGpsLogin', {
				path: '/auth/wtrl',
				httpOnly: true,
				sameSite: 'lax',
				secure: secureCookies
			});

			const identity = await exchangeWtrlCode(
				code,
				clientId,
				redirectUri,
				consumed.verifier
			);

			const oldSession = req.cookies.wtrlGpsSession;

			if (
				typeof oldSession === 'string' &&
				/^[a-f0-9]{64}$/.test(oldSession)
			) {
				await sessions.del(oldSession);
			}

			const sessionToken = crypto.randomBytes(32).toString('hex');

			await sessions.set(sessionToken, { identity });

			res.cookie('wtrlGpsSession', sessionToken, {
				httpOnly: true,
				sameSite: 'lax',
				secure: secureCookies,
				path: '/',
				maxAge: 86400000
			});

			res.redirect(frontendUrl);
		} catch (error) {
			console.error('WTRL sign-in failed:', error.message);

			res.status(502).send(
				'WTRL sign-in could not be completed. Please start again.'
			);
		}
	});

	return {
		getRouteHeaders(req) {
			const token = req.cookies.wtrlGpsSession;

			if (
				typeof token !== 'string' ||
				!/^[a-f0-9]{64}$/.test(token)
			) {
				return null;
			}

			return {
				'Authorization': `Bearer ${token}`,
				'X-GPS-Client-ID': clientId,
				'Accept': 'application/json'
			};
		},
		async clearSession(req, res) {
			const token = req.cookies.wtrlGpsSession;

			if (
				typeof token === 'string' &&
				/^[a-f0-9]{64}$/.test(token)
			) {
				await sessions.del(token);
			}

			const browserToken = req.cookies.wtrlGpsLogin;

			if (
				typeof browserToken === 'string' &&
				/^[a-f0-9]{64}$/.test(browserToken)
			) {
				await pendingLogins.del(browserToken);
			}

			res.clearCookie('wtrlGpsSession', {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: secureCookies
			});

			res.clearCookie('wtrlGpsLogin', {
				path: '/auth/wtrl',
				httpOnly: true,
				sameSite: 'lax',
				secure: secureCookies
			});
		},

		async getIdentity(req) {
			const token = req.cookies.wtrlGpsSession;

			if (
				typeof token !== 'string' ||
				!/^[a-f0-9]{64}$/.test(token)
			) {
				return null;
			}

			const session = await sessions.get(token);

			if (
				!session ||
				!Number.isFinite(session.expiresAt) ||
				session.expiresAt <= Date.now()
			) {
				return null;
			}

			const identity = session.identity;

			if (
				!identity ||
				!Number.isSafeInteger(identity.userId) ||
				identity.userId <= 0 ||
				!Number.isSafeInteger(identity.zwid) ||
				identity.zwid <= 0 ||
				typeof identity.uuid !== 'string' ||
				!identity.uuid
			) {
				return null;
			}

			return identity;
		}
	};

}

module.exports = registerWtrlAuth;

