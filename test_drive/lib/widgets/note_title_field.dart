import 'package:flutter/material.dart';

class NoteTitleField extends StatefulWidget {
  final String? initialValue;
  final bool autofocus;
  final ValueChanged<String>? onChanged;

  const NoteTitleField({
    super.key,
    this.initialValue,
    this.autofocus = false,
    this.onChanged,
  });

  @override
  State<NoteTitleField> createState() => _NoteTitleFieldState();
}

class _NoteTitleFieldState extends State<NoteTitleField> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      autofocus: widget.autofocus,
      onChanged: widget.onChanged,
      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
      decoration: const InputDecoration(
        hintText: 'Title',
        border: InputBorder.none,
        contentPadding: EdgeInsets.zero,
      ),
    );
  }
}

