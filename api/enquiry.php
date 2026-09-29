<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $data): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    respond(405, ['success' => false, 'message' => 'This request method is not supported.']);
}

session_name('diravo_enquiry');
session_start([
    'cookie_httponly' => true,
    'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'cookie_samesite' => 'Lax',
    'use_strict_mode' => true,
]);

if (!isset($_SESSION['csrf_token'], $_SESSION['csrf_created']) || time() - $_SESSION['csrf_created'] > 7200) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    $_SESSION['csrf_created'] = time();
}

if ($method === 'GET') {
    respond(200, ['token' => $_SESSION['csrf_token']]);
}

if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 20000) {
    respond(413, ['success' => false, 'message' => 'Your enquiry is too long. Please shorten it and try again.']);
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $originHost = parse_url($origin, PHP_URL_HOST);
    $originPort = parse_url($origin, PHP_URL_PORT);
    $originAuthority = strtolower((string) $originHost . ($originPort ? ':' . $originPort : ''));
    if ($originAuthority !== strtolower($_SERVER['HTTP_HOST'] ?? '')) {
        respond(403, ['success' => false, 'message' => 'Please submit your enquiry from the DIRAVO website.']);
    }
}

$token = $_POST['csrf_token'] ?? '';
if (!is_string($token) || !hash_equals($_SESSION['csrf_token'], $token)) {
    respond(403, ['success' => false, 'message' => 'Your form session expired. Please try sending your enquiry again.']);
}
session_write_close();

if (!empty($_POST['website'])) {
    respond(200, ['success' => true]);
}

function field(string $name, int $limit, bool $multiline = false): string
{
    $value = $_POST[$name] ?? '';
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) {
        respond(422, ['success' => false, 'message' => 'Please check your form details and try again.']);
    }
    $value = trim($value);
    if (mb_strlen($value) > $limit || (!$multiline && preg_match('/[\x00-\x1f\x7f]/u', $value))) {
        respond(422, ['success' => false, 'message' => 'Please check your form details. A field is too long or contains unsupported characters.']);
    }
    if ($multiline && preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u', $value)) {
        respond(422, ['success' => false, 'message' => 'Please remove unsupported characters from your message.']);
    }
    return $value;
}

$name = field('name', 100);
$organisation = field('organisation', 150);
$email = field('email', 254);
$phone = field('phone', 40);
$purpose = field('purpose', 100);
$message = field('message', 5000, true);
$services = $_POST['services'] ?? [];
$allowedServices = ['Training & Advisory', 'Public Relations & Communications', 'Events & Experiences', 'All services', 'Something else'];
$allowedPurposes = ['Request a quotation', 'Book a consultation', 'Training enquiry', 'General enquiry'];

if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($message) < 10) {
    respond(422, ['success' => false, 'message' => 'Please enter your name, a valid email address and a message of at least 10 characters.']);
}
if (!is_array($services) || $services === [] || count($services) > count($allowedServices)) {
    respond(422, ['success' => false, 'message' => 'Please select at least one service.']);
}
foreach ($services as $service) {
    if (!is_string($service) || !in_array($service, $allowedServices, true)) {
        respond(422, ['success' => false, 'message' => 'Please select a valid service.']);
    }
}
if (!in_array($purpose, $allowedPurposes, true)) {
    respond(422, ['success' => false, 'message' => 'Please select how we can help.']);
}
$services = array_values(array_unique($services));
if (in_array('All services', $services, true)) {
    $services = ['All services'];
}

$config = [
    'transport' => 'smtp', 'host' => '', 'port' => 587, 'encryption' => 'tls',
    'username' => '', 'password' => '', 'from_email' => 'engage@diravoice-ltd.org',
    'from_name' => 'DIRAVO Website', 'recipient' => 'engage@diravoice-ltd.org',
];
$localConfig = dirname(__DIR__) . '/config/mail.local.php';
if (is_file($localConfig)) {
    $local = require $localConfig;
    if (is_array($local)) {
        $config = array_replace($config, $local);
    }
}
foreach (array_keys($config) as $key) {
    $environment = getenv('MAIL_' . strtoupper($key));
    if ($environment !== false) {
        $config[$key] = $environment;
    }
}
$fallback = 'We couldn’t send your enquiry just yet. Please email engage@diravoice-ltd.org or contact us on WhatsApp.';
$autoload = dirname(__DIR__) . '/vendor/autoload.php';
if (!is_file($autoload) || ($config['transport'] === 'smtp' && $config['host'] === '')) {
    respond(503, ['success' => false, 'message' => $fallback]);
}

// Server-side, per-address rate limiting; do not trust client-supplied forwarding headers.
$rateDirectory = getenv('ENQUIRY_RATE_DIR') ?: sys_get_temp_dir() . '/diravo-enquiry-' . substr(hash('sha256', __DIR__), 0, 12);
if (!is_dir($rateDirectory) && !@mkdir($rateDirectory, 0700, true) && !is_dir($rateDirectory)) {
    respond(503, ['success' => false, 'message' => $fallback]);
}
$rateFile = $rateDirectory . '/' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown') . '.json';
$handle = @fopen($rateFile, 'c+');
if ($handle === false || !flock($handle, LOCK_EX)) {
    if (is_resource($handle)) {
        fclose($handle);
    }
    respond(503, ['success' => false, 'message' => $fallback]);
}
$stored = json_decode(stream_get_contents($handle) ?: '[]', true);
$attempts = array_filter(is_array($stored) ? $stored : [], static fn ($time): bool => is_int($time) && $time > time() - 3600);
if (count($attempts) >= 5) {
    flock($handle, LOCK_UN);
    fclose($handle);
    header('Retry-After: 3600');
    respond(429, ['success' => false, 'message' => 'You’ve sent several enquiries recently. Please contact us directly or try again later.']);
}
$attempts[] = time();
ftruncate($handle, 0);
rewind($handle);
fwrite($handle, json_encode(array_values($attempts), JSON_THROW_ON_ERROR));
flock($handle, LOCK_UN);
fclose($handle);

require $autoload;
try {
    $mailer = new PHPMailer(true);
    $mailer->CharSet = 'UTF-8';
    $mailer->Timeout = 15;
    if ($config['transport'] === 'smtp') {
        $mailer->isSMTP();
        $mailer->Host = (string) $config['host'];
        $mailer->Port = (int) $config['port'];
        $mailer->SMTPAuth = $config['username'] !== '';
        $mailer->Username = (string) $config['username'];
        $mailer->Password = (string) $config['password'];
        $mailer->SMTPSecure = match ($config['encryption']) {
            'tls' => PHPMailer::ENCRYPTION_STARTTLS,
            'ssl' => PHPMailer::ENCRYPTION_SMTPS,
            'none' => '',
            default => throw new RuntimeException('Invalid mail encryption configuration'),
        };
        $mailer->SMTPAutoTLS = $config['encryption'] !== 'none';
    } elseif ($config['transport'] === 'mail') {
        $mailer->isMail();
    } else {
        throw new RuntimeException('Invalid mail transport');
    }
    $mailer->setFrom((string) $config['from_email'], (string) $config['from_name']);
    $mailer->addAddress((string) $config['recipient']);
    $mailer->addReplyTo($email, $name);
    $mailer->Subject = 'Website enquiry: ' . $purpose;
    $mailer->isHTML(false);
    $mailer->Body = "New DIRAVO website enquiry\n\n"
        . "Name: {$name}\nOrganisation: " . ($organisation ?: 'Not provided') . "\n"
        . "Email: {$email}\nPhone: " . ($phone ?: 'Not provided') . "\n"
        . "Enquiry: {$purpose}\nServices: " . implode(', ', $services) . "\n\nMessage:\n{$message}\n";
    $mailer->send();
    respond(200, ['success' => true]);
} catch (Throwable $exception) {
    // Keep server/mailbox configuration and visitor details out of the public response and logs.
    error_log('DIRAVO enquiry: email transport failed (' . get_class($exception) . ').');
    respond(503, ['success' => false, 'message' => $fallback]);
}
