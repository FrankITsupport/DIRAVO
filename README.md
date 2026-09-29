# DIRAVO website

A responsive, one-page website using HTML, CSS, JavaScript and a PHP enquiry handler. Every main section has a minimum viewport height and can grow to accommodate mobile content or expanded details. The client originals remain in the ignored `client data` folder.

## Preview locally

Requires PHP 8.2 or newer with mbstring, OpenSSL and sessions. Install the form's email library once:

```sh
composer install
php -S 127.0.0.1:8085 scripts/serve.php
```

Open http://127.0.0.1:8085. The included router prevents the preview from serving client originals, configuration and other internal files. The page can also be opened directly for visual review, but the PHP form needs the server.

## Configure enquiry email

Copy `config/mail.example.php` to `config/mail.local.php` and enter the SMTP details of your existing mailbox. The local configuration is ignored by Git. SMTP is the default transport; the host must be configured before live form delivery is enabled. The sender should be an address your mail service authorises. Replies go to the visitor's email address; the recipient is controlled by server configuration.

Alternatively, set these server environment variables:

- `MAIL_HOST`, `MAIL_PORT` (default 587), `MAIL_ENCRYPTION` (`tls`, `ssl`, or `none` for a local development mail sink).
- `MAIL_USERNAME`, `MAIL_PASSWORD`.
- `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `MAIL_RECIPIENT`.
- `MAIL_TRANSPORT` (default `smtp`; use `mail` only if your host already provides PHP mail transport).

If delivery is not configured or the mail service fails, the form keeps the visitor's input and shows a useful error with email and WhatsApp alternatives. It only reports success after the configured transport accepts the email. No visitor enquiries are stored in the repository. The handler includes server-side validation, a session token, a honeypot and a limit of five sending attempts per address per hour.

For production, upload `index.html`, `assets/`, `api/`, `config/`, `vendor/`, `.htaccess`, `robots.txt` and `sitemap.xml`. Keep original client files, scripts, tests and preview artifacts out of the public web directory. On Apache, the included `.htaccess` also denies access to internal directories; equivalent access rules are needed if using another web server. Install dependencies with `composer install --no-dev --optimize-autoloader` if preparing a deployment separately.

## Make content changes

- Copy, services, biographies, contact links and SEO metadata: `index.html`.
- Colours, type, layout and responsive breakpoints: `assets/css/styles.css`.
- Gallery photographs and interactive behaviour: `assets/js/main.js`.
- Prepared photographs: `assets/images/`; logo variants: `assets/brand/`.
- Email destination and sender: local mail configuration or environment variables.

The initial WhatsApp destination is the latest profile's number: `254704534029`. Update both WhatsApp links and phone links in the HTML if it changes. The canonical URL, social metadata, structured data, sitemap and robots file use `https://www.diravoice-ltd.org/` from the latest profile; keep these consistent with the final live hostname.

The font is self-hosted Manrope under the SIL Open Font License; see `assets/fonts/OFL.txt`. The project uses PHPMailer under its bundled LGPL licence. All substantive page content, including expandable details, is present in the HTML.

## Verify the email handler

With Node.js and PHP available, run `node tests/verify-enquiry.mjs`. It starts isolated local PHP and SMTP servers, checks validation and email delivery, and shuts them down. It never sends email to an external mailbox. Browser checks and preview screenshots are kept in the ignored `artifacts` folder during development.
