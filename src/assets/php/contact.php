<?php

declare(strict_types=1);

const CONTACT_RECIPIENT = 'lou@lartdelou.be';
const CONTACT_FROM = 'lou@lartdelou.be';
const THANK_YOU_URL = '/merci/';
const CONTACT_URL = '/contact.html';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Location: ' . CONTACT_URL);
    exit;
}

if (!empty($_POST['bot-field'] ?? '')) {
    header('Location: ' . THANK_YOU_URL);
    exit;
}

function field(string $name): string
{
    return trim((string) ($_POST[$name] ?? ''));
}

function clean_header(string $value): string
{
    return str_replace(["\r", "\n"], ' ', $value);
}

$lastName = field('nom');
$firstName = field('prenom');
$email = field('email');
$subject = field('objet');
$message = field('message');

if ($lastName === '' || $firstName === '' || $email === '' || $subject === '' || $message === '') {
    http_response_code(400);
    header('Location: ' . CONTACT_URL);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    header('Location: ' . CONTACT_URL);
    exit;
}

$safeName = clean_header($firstName . ' ' . $lastName);
$safeSubject = clean_header($subject);
$mailSubject = '[Lart de Lou] ' . $safeSubject;
if (function_exists('mb_encode_mimeheader')) {
    $mailSubject = mb_encode_mimeheader($mailSubject, 'UTF-8');
}
$body = implode("\n", [
    'Nouveau message depuis le formulaire de contact Lart de Lou.',
    '',
    'Nom: ' . $lastName,
    'Prenom: ' . $firstName,
    'Email: ' . $email,
    'Objet: ' . $subject,
    '',
    'Message:',
    $message,
]);

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: Lart de Lou <' . CONTACT_FROM . '>',
    'Reply-To: ' . $safeName . ' <' . clean_header($email) . '>',
];

$sent = mail(
    CONTACT_RECIPIENT,
    $mailSubject,
    $body,
    implode("\r\n", $headers),
    '-f ' . CONTACT_FROM
);

if (!$sent) {
    http_response_code(500);
    header('Location: ' . CONTACT_URL);
    exit;
}

header('Location: ' . THANK_YOU_URL);
exit;
