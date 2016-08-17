var restify = require('restify');
var Logger = require('bunyan');
var log = new Logger({
	name: 'stripe-donation-processor'
});

var isTestMode = getFromEnv('STRIPE_TEST_MODE') || true;
var keys = {
	private_test: getFromEnv('STRIPE_KEY_PRIVATE_TEST'),
	private_live: getFromEnv('STRIPE_KEY_PRIVATE_LIVE')
};
var port = getFromEnv('PORT') || '8080';

var stripe = require('stripe')((isTestMode ? keys.private_test : keys.private_live));

function charge(req, res, next) {
	var opts = {
		amount: req.params.amount || throwError('400', 'E_MISSING_REQUIRED_PARAM', 'amount'),
		currency: 'usd',
		source: req.params.token || throwError('400', 'E_MISSING_REQUIRED_PARAM', 'token'),
		description: 'Donation - ' + req.params.email,
		capture: true,
		receipt_email: req.params.email || throwError('400', 'E_MISSING_REQUIRED_PARAM', 'email'),
		statement_descriptor: 'AKPWebDesign Donation'
	};

	stripe.charges.create(opts, (err, charge) => {
		if(err) {
			switch (err.type) {
			  case 'StripeCardError':
			    // A declined card error
					throwError('400', 'E_STRIPE_CARD_ERROR', err.message);
			    break;
			  case 'RateLimitError':
			  case 'StripeInvalidRequestError':
			  case 'StripeAPIError':
			  case 'StripeConnectionError':
			  case 'StripeAuthenticationError':
					throwError('400', 'E_STRIPE_ERROR', 'null');
					break;
			  default:
			    // Handle any other types of unexpected errors
					throwError('400', 'E_STRIPE_ERROR', 'null');
			    break;
			}
			next(new restify.errors.BadRequestError(err.message || null));
		} else {
			res.json({success: true});
			log.info({charge: charge}, 'Successfully charged card.');
		  next();
		}
	});
}

function getFromEnv(key) {
	return process.env[key] || null;
}

function throwError(http_status, e_code, message) {
	log.error({http_status: http_status, e_code: e_code, message: message}, 'Error while processing charge!');
}

var server = restify.createServer({
	name: 'Stripe Donation Processor',
	log: log
});

server.use(restify.gzipResponse());

server.get('/charge/:email/:token/:amount', charge);

server.listen(port, function() {
  log.info('%s listening at %s', server.name, server.url);
	log.info('Stripe using key \'%s\' in %s mode.', isTestMode ? keys.private_test : keys.private_live, isTestMode ? 'test': 'live');
});
