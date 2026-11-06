import 'package:clipforge_companion/core/constants/environment.dart';
import 'package:clipforge_companion/core/utils/formatters.dart';
import 'package:clipforge_companion/core/utils/json_cast.dart';
import 'package:clipforge_companion/core/utils/validators.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Validators', () {
    test('baseUrl accepts loopback and LAN origins', () {
      expect(Validators.baseUrl('http://127.0.0.1:4173'), isNull);
      expect(Validators.baseUrl('http://10.0.2.2:4173'), isNull);
      expect(Validators.baseUrl('https://studio.example.com'), isNull);
      expect(Validators.baseUrl('http://localhost:4173/'), isNull);
    });

    test('baseUrl rejects malformed origins', () {
      expect(Validators.baseUrl(''), isNotNull);
      expect(Validators.baseUrl('127.0.0.1:4173'), isNotNull);
      expect(Validators.baseUrl('ftp://127.0.0.1'), isNotNull);
      expect(Validators.baseUrl('http://127.0.0.1:4173/api'), isNotNull);
    });

    test('prompt requires a usable description', () {
      expect(Validators.prompt(''), isNotNull);
      expect(Validators.prompt('short'), isNotNull);
      expect(Validators.prompt('A cinematic ocean sunrise'), isNull);
    });

    test('modelId bounds length', () {
      expect(Validators.modelId('gpt-5.1'), isNull);
      expect(Validators.modelId(''), isNotNull);
      expect(Validators.modelId('x' * 121), isNotNull);
    });
  });

  group('Formatters', () {
    test('currency and percent', () {
      expect(Formatters.usd(2.5), '\$2.50');
      expect(Formatters.percent(0.25), '25%');
    });

    test('capability labels', () {
      expect(Formatters.capabilityLabel('script'), 'Script');
      expect(Formatters.capabilityLabel('image'), 'Image');
      expect(Formatters.capabilityLabel('video'), 'Video');
      expect(Formatters.capabilityLabel('voice'), 'Voice');
      expect(Formatters.capabilityLabel('other'), 'Other');
      expect(Formatters.capabilityLabel(''), 'Unknown');
    });

    test('editorUrl strips trailing slashes', () {
      expect(EnvConfig.editorUrl('http://127.0.0.1:4173/'),
          'http://127.0.0.1:4173');
      expect(EnvConfig.presets.length, 3);
    });
  });

  group('json_cast', () {
    test('tolerates missing, null and mistyped values', () {
      expect(asString(null, 'fallback'), 'fallback');
      expect(asDouble('1.5'), 1.5);
      expect(asInt(3.9), 3);
      expect(asBool('true'), isTrue);
      expect(asBool(null), isFalse);
      expect(asMap('nope'), isEmpty);
      expect(asMapList(null), isEmpty);
      expect(asStringList(<dynamic>[1, 'two']), <String>['1', 'two']);
    });
  });
}
