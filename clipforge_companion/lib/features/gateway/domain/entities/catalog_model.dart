import '../../../../core/utils/formatters.dart';
import '../../../../core/utils/json_cast.dart';

class CatalogModel {
  const CatalogModel({
    required this.capability,
    required this.id,
    required this.label,
    required this.provider,
    required this.env,
    required this.cost,
    required this.tier,
    required this.detail,
    required this.contract,
    required this.alternatives,
  });

  factory CatalogModel.fromJson(Map<String, dynamic> json) => CatalogModel(
        capability: asString(json['capability']),
        id: asString(json['id']),
        label: asString(json['label']),
        provider: asString(json['provider']),
        env: asString(json['env']),
        cost: asDouble(json['cost']),
        tier: asString(json['tier']),
        detail: asString(json['detail']),
        contract: asString(json['contract']),
        alternatives: asStringList(json['alternatives']),
      );

  final String capability;
  final String id;
  final String label;
  final String provider;
  final String env;
  final double cost;
  final String tier;
  final String detail;
  final String contract;
  final List<String> alternatives;

  String get capabilityLabel => Formatters.capabilityLabel(capability);

  Map<String, dynamic> toJson() => <String, dynamic>{
        'capability': capability,
        'id': id,
        'label': label,
        'provider': provider,
        'env': env,
        'cost': cost,
        'tier': tier,
        'detail': detail,
        'contract': contract,
        'alternatives': alternatives,
      };
}

class LedgerEntry {
  const LedgerEntry({
    required this.at,
    required this.capability,
    required this.model,
    required this.cost,
  });

  factory LedgerEntry.fromJson(Map<String, dynamic> json) => LedgerEntry(
        at: asInt(json['at']),
        capability: asString(json['capability']),
        model: asString(json['model']),
        cost: asDouble(json['cost']),
      );

  final int at;
  final String capability;
  final String model;
  final double cost;

  String get when => at <= 0 ? '—' : Formatters.relativeTime(at);
}
