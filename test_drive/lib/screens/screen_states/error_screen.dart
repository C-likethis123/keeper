import 'package:flutter/material.dart';

class ErrorScreen extends StatelessWidget {
  final String errorMessage;
  final VoidCallback? onRetry;

  const ErrorScreen({super.key, required this.errorMessage, this.onRetry});

 

  @override
  Widget build(BuildContext context) {
    List<Widget> content = [
      Icon(Icons.error_outline, size: 48, color: Theme.of(context).colorScheme.error),
      Text(errorMessage, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge),
    ];
    if (onRetry != null) {
      content.add(FilledButton(onPressed: onRetry, child: const Text('Retry')));
    }
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          spacing: 16,
          children: content,
        ),
      ),
    );
  }
}