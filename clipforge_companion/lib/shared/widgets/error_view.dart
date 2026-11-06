import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_sizes.dart';
import '../../core/constants/app_strings.dart';

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSizes.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Icon(Icons.cloud_off, color: AppColors.warn, size: 40),
            const SizedBox(height: AppSizes.m),
            const Text(
              'Gateway unreachable',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSizes.s),
            Text(
              message,
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSizes.s),
            const Text(
              AppStrings.offlineHint,
              style: TextStyle(color: AppColors.muted, fontSize: 12),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSizes.l),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
