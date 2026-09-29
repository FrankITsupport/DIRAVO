<?php
declare(strict_types=1);

// Copy to mail.local.php and enter your existing hosting/mailbox settings.
// Alternatively, use the environment variables documented in README.md.
return [
    'transport' => 'smtp',
    'host' => '',
    'port' => 587,
    'encryption' => 'tls',
    'username' => '',
    'password' => '',
    'from_email' => 'engage@diravoice-ltd.org',
    'from_name' => 'DIRAVO Website',
    'recipient' => 'engage@diravoice-ltd.org',
];
