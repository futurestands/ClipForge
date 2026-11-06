import 'package:clipforge_companion/features/gateway/domain/entities/catalog_model.dart';
import 'package:clipforge_companion/features/gateway/domain/entities/gateway_status.dart';
import 'package:clipforge_companion/features/studio/domain/entities/generation.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fakes.dart';

void main() {
  group('GatewayStatus.fromJson — live /api/status fixture', () {
    final GatewayStatus status = GatewayStatus.fromJson(fixture('status.json'));

    test('parses connection, version and provider flags', () {
      expect(status.online, isTrue);
      expect(status.version, '1.0.0');
      expect(status.providers.length, 4);
      expect(status.configuredCount, 0);
      expect(status.allLocal, isTrue);
      expect(status.isConfigured('script'), isFalse);
      expect(status.labelFor('image'), contains('FAL_KEY'));
    });

    test('parses budget and derived values', () {
      expect(status.budget.cap, 2.5);
      expect(status.budget.spent, 0);
      expect(status.budget.calls, 0);
      expect(status.budget.fraction, 0);
      expect(status.budget.remaining, 2.5);
    });

    test('parses model defaults and catalog', () {
      expect(status.defaults.scriptModel, 'gpt-5.1');
      expect(status.defaults.imageModel, 'fal-ai/flux-2-pro');
      expect(status.defaults.videoModel, 'fal-ai/veo3.1');
      expect(status.defaults.voiceModel, 'eleven_multilingual_v2');
      expect(status.models.length, 4);
      expect(status.models.map((CatalogModel m) => m.capability).toList(),
          <String>['script', 'image', 'video', 'voice']);
      expect(status.recent, isEmpty);
    });

    test('catalog model keeps the research metadata', () {
      final CatalogModel script = status.models.first;
      expect(script.id, 'gpt-5.1');
      expect(script.label, 'GPT-5.1');
      expect(script.env, 'OPENAI_API_KEY');
      expect(script.cost, 0.06);
      expect(script.tier, 'frontier');
      expect(script.contract, contains('chat/completions'));
      expect(script.alternatives, contains('claude-opus-4-5'));
      expect(script.capabilityLabel, 'Script');
      expect(CatalogModel.fromJson(script.toJson()).id, script.id);
    });

    test('ModelDefaults copyWith / toJson round-trip', () {
      final ModelDefaults edited = status.defaults.copyWith(scriptModel: 'gpt-5.2');
      expect(edited.scriptModel, 'gpt-5.2');
      expect(edited.imageModel, 'fal-ai/flux-2-pro');
      expect(ModelDefaults.fromJson(edited.toJson()).scriptModel, 'gpt-5.2');
    });
  });

  group('Defensive parsing', () {
    test('empty map yields an offline-like status instead of throwing', () {
      final GatewayStatus status = GatewayStatus.fromJson(<String, dynamic>{});
      expect(status.online, isFalse);
      expect(status.models, isEmpty);
      expect(status.providers, isEmpty);
      expect(status.version, '—');
    });

    test('GatewayStatus.offline exposes zeroed metrics', () {
      final GatewayStatus status = GatewayStatus.offline();
      expect(status.online, isFalse);
      expect(status.allLocal, isTrue);
      expect(status.budget.fraction, 0);
    });

    test('mixed numeric types are tolerated', () {
      final GatewayBudget budget = GatewayBudget.fromJson(<String, dynamic>{
        'spent': '1.25',
        'cap': 5,
        'calls': '3',
      });
      expect(budget.spent, 1.25);
      expect(budget.cap, 5);
      expect(budget.calls, 3);
      expect(budget.fraction, closeTo(0.25, 0.0001));
    });
  });

  group('Other live fixtures', () {
    test('/api/models catalog shape', () {
      final List<dynamic> models = fixture('models.json')['models'] as List<dynamic>;
      expect(models.length, 4);
    });

    test('/api/fallback message', () {
      final FallbackInfo info = FallbackInfo.fromJson(fixture('fallback.json'));
      expect(info.message, contains('100% locally'));
      expect(info.providers.length, 4);
    });

    test('all provider calls fail soft without keys', () {
      for (final String name in <String>[
        'script_no_key.json',
        'image_no_key.json',
        'video_no_key.json',
        'voice_no_key.json',
      ]) {
        final Map<String, dynamic> json = fixture(name);
        expect(json['ok'], isFalse, reason: '$name should be a fail-soft response');
        expect(json['reason'], isA<String>());
        expect(json['reason'] as String, contains('No '));
      }
    });

    test('ScriptResult parses a strict-JSON shot list', () {
      final ScriptResult result = ScriptResult.fromJson(successfulScriptResponse());
      expect(result.model, 'gpt-5.1');
      expect(result.cost, 0.06);
      expect(result.scenes.length, 2);
      expect(result.scenes.first.caption, 'A NEW HORIZON');
      expect(result.scenes.last.imagePrompt, contains('violet water'));
    });

    test('ImageResult counts data URLs and keeps null fallback slots', () {
      final ImageResult images = ImageResult.fromJson(<String, dynamic>{
        'ok': true,
        'model': 'fal-ai/flux-2-pro',
        'cost': 0.1,
        'images': <String?>['data:image/jpeg;base64,AAAA', null],
      });
      expect(images.images.length, 2);
      expect(images.renderedCount, 1);
    });
  });
}
