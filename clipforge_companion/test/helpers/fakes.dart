import 'dart:convert';
import 'dart:io';

import 'package:clipforge_companion/features/gateway/data/gateway_remote_datasource.dart';

/// Reads a real gateway response captured by tool/contract_probe.mjs.
Map<String, dynamic> fixture(String name) {
  final File file = File('test/fixtures/$name');
  return jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
}

/// Hand-written fake — no mocktail/codegen needed, and it records the exact
/// endpoints a flow touched so tests can assert the request chain.
class FakeGatewayRemoteDataSource implements GatewayRemoteDataSource {
  FakeGatewayRemoteDataSource({
    this.responses = const <String, Map<String, dynamic>>{},
    this.failures = const <String>{},
    this.errorMessage = 'Connection refused',
  });

  final Map<String, Map<String, dynamic>> responses;
  final Set<String> failures;
  final String errorMessage;
  final List<String> calls = <String>[];

  Map<String, dynamic> _take(String key) {
    calls.add(key);
    if (failures.contains(key)) throw Exception(errorMessage);
    return responses[key] ??
        const <String, dynamic>{'ok': false, 'reason': 'No provider key configured'};
  }

  @override
  Future<Map<String, dynamic>> health() async => _take('health');

  @override
  Future<Map<String, dynamic>> status() async => _take('status');

  @override
  Future<Map<String, dynamic>> models() async => _take('models');

  @override
  Future<Map<String, dynamic>> fallback() async => _take('fallback');

  @override
  Future<Map<String, dynamic>> saveKeys(Map<String, String> keys) async =>
      _take('saveKeys');

  @override
  Future<Map<String, dynamic>> saveModels(Map<String, String> models) async =>
      _take('saveModels');

  @override
  Future<Map<String, dynamic>> setBudget({required double cap, bool reset = false}) async =>
      _take('setBudget');

  @override
  Future<Map<String, dynamic>> script(Map<String, dynamic> body) async =>
      _take('script');

  @override
  Future<Map<String, dynamic>> image(Map<String, dynamic> body) async =>
      _take('image');

  @override
  Future<Map<String, dynamic>> video(Map<String, dynamic> body) async =>
      _take('video');

  @override
  Future<Map<String, dynamic>> voice(Map<String, dynamic> body) async =>
      _take('voice');
}

/// Every endpoint mapped to the response captured by the live contract probe.
Map<String, Map<String, dynamic>> fixtureResponses() => <String, Map<String, dynamic>>{
      'status': fixture('status.json'),
      'fallback': fixture('fallback.json'),
      'saveKeys': fixture('keys_response.json'),
      'saveModels': fixture('models_response.json'),
      'setBudget': fixture('budget.json'),
      'script': fixture('script_no_key.json'),
      'image': fixture('image_no_key.json'),
      'video': fixture('video_no_key.json'),
      'voice': fixture('voice_no_key.json'),
    };

FakeGatewayRemoteDataSource fixtureSource() =>
    FakeGatewayRemoteDataSource(responses: fixtureResponses());

Map<String, dynamic> successfulScriptResponse() => <String, dynamic>{
      'ok': true,
      'model': 'gpt-5.1',
      'cost': 0.06,
      'scenes': <Map<String, dynamic>>[
        <String, dynamic>{
          'beat': 'Hook',
          'caption': 'A NEW HORIZON',
          'narration': 'A lone astronaut watches the alien sunrise.',
          'camera': 'slow dolly push-in',
          'imagePrompt': 'Cinematic wide shot of an astronaut above an alien ocean at dawn',
        },
        <String, dynamic>{
          'beat': 'Outro',
          'caption': 'BEYOND THE EDGE',
          'narration': 'The light reaches further than anyone expected.',
          'camera': 'crane pull-back',
          'imagePrompt': 'Epic sunrise over violet water, volumetric light',
        },
      ],
    };
