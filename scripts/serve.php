<?php
declare(strict_types=1);

// Router for the local PHP preview. Only website resources are publicly accessible.
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$root = dirname(__DIR__);
if ($path === '/' || $path === '/index.html') {
    header('Content-Type: text/html; charset=utf-8');
    readfile($root . '/index.html');
    return true;
}
if ($path === '/api/enquiry.php') {
    require $root . '/api/enquiry.php';
    return true;
}
$file = realpath($root . $path);
$assetRoot = realpath($root . '/assets') . DIRECTORY_SEPARATOR;
if ($file && is_file($file) && str_starts_with($file, $assetRoot) && in_array(strtolower(pathinfo($file, PATHINFO_EXTENSION)), ['css', 'js', 'svg', 'webp', 'png', 'ico', 'ttf'], true)) {
    return false;
}
if (in_array($path, ['/robots.txt', '/sitemap.xml'], true)) {
    return false;
}
http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
echo '<!doctype html><html lang="en"><meta charset="utf-8"><title>Page not found — DIRAVO</title><body><h1>Page not found</h1><p><a href="/">Return to DIRAVO</a></p></body></html>';
return true;
