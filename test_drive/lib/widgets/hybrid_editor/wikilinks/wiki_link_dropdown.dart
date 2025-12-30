import 'package:flutter/material.dart';
import 'wiki_link_controller.dart';

class WikiLinkDropdown extends StatelessWidget {
  final WikiLinkController controller;
  final ValueChanged<String> onSelect;

  const WikiLinkDropdown({
    super.key,
    required this.controller,
    required this.onSelect,
  });

  static const double _itemHeight = 40;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        if (!controller.isActive || controller.results.isEmpty) {
          return const SizedBox.shrink();
        }

        final theme = Theme.of(context);

        return Material(
          elevation: 8,
          borderRadius: BorderRadius.circular(8),
          color: theme.colorScheme.surface,
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 4),
            itemExtent: _itemHeight,
            itemCount: controller.results.length,
            itemBuilder: (context, index) {
              final title = controller.results[index];
              final isSelected = index == controller.selectedIndex;

              return InkWell(
                onTap: () => onSelect(title),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  alignment: Alignment.centerLeft,
                  decoration: BoxDecoration(
                    color: isSelected
                        ? theme.colorScheme.primary.withValues(alpha: 0.1)
                        : null,
                  ),
                  child: Text(
                    title,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: isSelected
                          ? theme.colorScheme.primary
                          : theme.colorScheme.onSurface,
                      fontWeight: isSelected
                          ? FontWeight.w600
                          : FontWeight.normal,
                    ),
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}
