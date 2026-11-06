import 'package:clipforge_companion/features/gateway/data/gateway_repository.dart';
import 'package:clipforge_companion/features/gateway/domain/entities/gateway_status.dart';
import 'package:clipforge_companion/features/studio/domain/entities/generation.dart';
import 'package:clipforge_companion/shared/models/api_outcome.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fakes.dart';

void main() {
  group('GatewayRepository — GET + config endpoints', () {
    late FakeGatewayRemoteDataSource source;
    late GatewayRepository repository;

    setUp(() {
      source = fixtureSource();
      repository = GatewayRepository(source);
    });

    test('fetchStatus parses the live shape', () async {
      final GatewayStatus status = await repository.fetchStatus();
      expect(status.online, isTrue);
      expect(status.version, '1.0.0');
      expect(status.models.length, 4);
      expect(source.calls, <String>['status']);
    });

    test('fetchFallback parses the local-generation message', () async {
      final FallbackInfo info = await repository.fetchFallback();
      expect(info.message, contains('Director v1'));
    });

    test('saveKeys echoes a refreshed status', () async {
      final GatewayStatus status =
          await repository.saveKeys(<String, String>{'OPENAI_API_KEY': 'test'});
      expect(status.online, isTrue);
      expect(status.configuredCount, 0);
    });

    test('saveModels parses the returned defaults', () async {
      final ModelDefaults defaults =
          await repository.saveModels(ModelDefaults.fromJson(fixture('status.json')['defaults'] as Map<String, dynamic>));
      expect(defaults.scriptModel, 'gpt-5.1');
      expect(defaults.videoModel, 'fal-ai/veo3.1');
    });

    test('setBudget parses the returned budget', () async {
      final GatewayBudget budget = await repository.setBudget(cap: 2.5);
      expect(budget.cap, 2.5);
      expect(budget.calls, 0);
    });
  });

  group('GatewayRepository — fail-soft provider calls', () {
    late GatewayRepository repository;

    setUp(() {
      repository = GatewayRepository(fixtureSource());
    });

    test('script without a key is a fallback outcome, not an exception', () async {
      final ApiOutcome<ScriptResult> outcome = await repository.generateScript(
        const ScriptRequest(
          prompt: 'A lone astronaut watching a sunrise over an alien ocean',
          style: 'cinematic',
          count: 5,
          duration: 15,
          cap: 2.5,
        ),
      );
      expect(outcome.ok, isFalse);
      expect(outcome.usedFallback, isTrue);
      expect(outcome.data, isNull);
      expect(outcome.displayReason, contains('OPENAI_API_KEY'));
    });

    test('image / video / voice all fail soft', () async {
      final ApiOutcome<ImageResult> images = await repository.generateImages(
        prompts: const <String>['alien ocean'],
        aspect: '16:9',
        cap: 2.5,
      );
      final ApiOutcome<VideoResult> video = await repository.generateVideo(
        prompt: 'alien ocean',
        aspect: '16:9',
        cap: 2.5,
      );
      final ApiOutcome<VoiceResult> voice = await repository.generateVoice(
        text: 'A new horizon.',
        cap: 2.5,
      );
      expect(images.displayReason, contains('FAL_KEY'));
      expect(video.displayReason, contains('FAL_KEY'));
      expect(voice.displayReason, contains('ELEVENLABS_API_KEY'));
    });

    test('a successful script response parses scenes and cost', () async {
      final GatewayRepository successRepo = GatewayRepository(
        FakeGatewayRemoteDataSource(
          responses: <String, Map<String, dynamic>>{
            'script': successfulScriptResponse(),
          },
        ),
      );
      final ApiOutcome<ScriptResult> outcome = await successRepo.generateScript(
        const ScriptRequest(
          prompt: 'A cinematic story about the ocean',
          style: 'cinematic',
          count: 2,
          duration: 10,
          cap: 2.5,
        ),
      );
      expect(outcome.ok, isTrue);
      expect(outcome.model, 'gpt-5.1');
      expect(outcome.cost, 0.06);
      expect(outcome.data!.scenes.length, 2);
    });

    test('network errors become a typed failure for status', () async {
      final GatewayRepository broken = GatewayRepository(
        FakeGatewayRemoteDataSource(failures: const <String>{'status'}),
      );
      await expectLater(broken.fetchStatus(), throwsA(isA<Exception>()));
    });

    test('network errors become a fallback outcome for provider calls', () async {
      final GatewayRepository broken = GatewayRepository(
        FakeGatewayRemoteDataSource(
          failures: const <String>{'script'},
          errorMessage: 'Connection refused',
        ),
      );
      final ApiOutcome<ScriptResult> outcome = await broken.generateScript(
        const ScriptRequest(
          prompt: 'Anything at all',
          style: 'auto',
          count: 3,
          duration: 10,
          cap: 2.5,
        ),
      );
      expect(outcome.ok, isFalse);
      expect(outcome.displayReason, contains('Connection refused'));
    });
  });

  group('ApiOutcome', () {
    test('success carries payload and metadata', () {
      final ApiOutcome<int> outcome =
          ApiOutcome<int>.success(42, model: 'gpt-5.1', cost: 0.06);
      expect(outcome.ok, isTrue);
      expect(outcome.usedFallback, isFalse);
      expect(outcome.data, 42);
      expect(outcome.model, 'gpt-5.1');
    });

    test('failure maps to a failure for a different type', () {
      final ApiOutcome<int> original = ApiOutcome<int>.failure('No FAL_KEY configured');
      final ApiOutcome<String> mapped =
          original.map<String>((int value) => 'unreachable v=$value');
      expect(mapped.ok, isFalse);
      expect(mapped.data, isNull);
      expect(mapped.displayReason, 'No FAL_KEY configured');
    });

    test('success maps the payload', () {
      final ApiOutcome<String> mapped =
          ApiOutcome<int>.success(7).map<String>((int v) => 'v=$v');
      expect(mapped.data, 'v=7');
    });
  });
}
