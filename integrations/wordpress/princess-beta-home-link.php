<?php
/**
 * Plugin Name: Princess of Pricing Home Link
 * Description: A front-page-only entry to Faith's private PoP beta.
 * Author: Faith Cheltenham
 * License: AGPL-3.0-or-later
 */

defined('ABSPATH') || exit;

add_action('wp_head', function () {
    if (!is_front_page()) {
        return;
    }
    ?>
    <style id="pop-home-link-style">
        .pop-home-link { background: #f1f6f5; border-bottom: 1px solid #cddbd8; color: #174d46; }
        .pop-home-link > div { max-width: 1280px; margin: 0 auto; padding: 11px 24px; }
        .pop-home-link a { display: inline; color: inherit; font: 600 14px/1.5 system-ui, sans-serif; letter-spacing: 0; text-decoration: underline; text-underline-offset: 3px; }
        .pop-home-link a:focus-visible { outline: 3px solid #987520; outline-offset: 4px; }
        .pop-home-link span { font-weight: 400; white-space: nowrap; }
    </style>
    <?php
});

add_action('wp_body_open', function () {
    if (!is_front_page()) {
        return;
    }
    ?>
    <aside class="pop-home-link" aria-label="Private beta tool"><div><a href="https://pop.thefayth.net/">Princess of Pricing <span>(private beta)</span></a></div></aside>
    <?php
});
