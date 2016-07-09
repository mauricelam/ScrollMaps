#! /usr/bin/env python

import json

GOOGLE_MAPS_CCTLDS = [
    "at", "au", "be", "br", "ca", "cf", "cg", "ch", "ci", "cl", "cn", "uk", "in", "jp", "th", "cz",
    "dj", "de", "dk", "ee", "es", "fi", "fr", "ga", "gm", "hk", "hr", "hu", "ie", "is", "it", "jp",
    "li", "lt", "lu", "lv", "mg", "mk", "mu", "mw", "nl", "no", "pl", "pt", "ro", "ru", "rw", "sc",
    "se", "sg", "si", "sk", "sn", "st", "td", "tg", "tr", "tw", "us"]

GOOGLE_MAPS_URL_FORMATS = [
    "*://www.google.{tld}/maps*",
    "*://www.google.com.{tld}/maps*",
    "*://www.google.co.{tld}/maps*",
    "*://maps.google.{tld}/*",
    "*://maps.google.com.{tld}/*",
    "*://maps.google.co.{tld}/*"
]

GOOGLE_MAPS_SPECIAL_URLS = [
    "*://www.google.com/maps*",
    "*://maps.google.com/*",
    "*://mapy.google.pl/*",
    "*://ditu.google.cn/*",
]


def generate_google_maps_urls():
    output = []
    for tld in GOOGLE_MAPS_CCTLDS:
        for format in GOOGLE_MAPS_URL_FORMATS:
            output.append(format.format(tld=tld))
    output.extend(GOOGLE_MAPS_SPECIAL_URLS)
    return output


def replace_google_urls(obj):
    if obj == u'<all_google_maps_urls>':
        return generate_google_maps_urls()
    elif isinstance(obj, dict):
        for key, value in obj.iteritems():
            obj[key] = replace_google_urls(value)
    elif isinstance(obj, list):
        for i, value in enumerate(obj):
            obj[i] = replace_google_urls(value)
    return obj

if __name__ == '__main__':
    with open('manifest_template.json', 'r') as template:
        with open('manifest.json', 'w') as manifest:
            manif = json.load(template)
            replace_google_urls(manif)
            json.dump(manif, manifest, indent=2)
