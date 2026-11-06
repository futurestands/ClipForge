import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';

class StatusDot extends StatelessWidget {
  const StatusDot({super.key, required this.active, this.size = 9});

  final bool active;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: active ? AppColors.success : AppColors.muted,
        shape: BoxShape.circle,
        boxShadow: <BoxShadow>[
          if (active)
            BoxShadow(
              color: AppColors.success.withOpacity(0.5),
              blurRadius: 8,
              spreadRadius: 1,
            ),
        ],
      ),
    );
  }
}
