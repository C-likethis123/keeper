import 'package:flutter/foundation.dart';
import 'package:test_drive/widgets/hybrid_editor/wikilinks/wiki_link_session.dart';

class WikiLinkController extends ChangeNotifier {
  WikiLinkSession? _session;
  String _query = '';
  List<String> _results = [];
  int _selectedIndex = 0;

  // --- Public getters ---
  bool get isActive => _session != null;
  WikiLinkSession? get session => _session;
  String get query => _query;
  List<String> get results => _results;
  int get selectedIndex => _selectedIndex;

  bool isActiveFor(int blockIndex) =>
      _session != null && _session!.blockIndex == blockIndex;

  // --- Lifecycle ---
  void start({required int blockIndex, required int startOffset}) {
    _session = WikiLinkSession(
      blockIndex: blockIndex,
      startOffset: startOffset,
    );
    _query = '';
    _results = [];
    _selectedIndex = 0;
    notifyListeners();
  }

  void updateQueryFromText({
    required String text,
    required int caretOffset,
    required Future<List<String>> Function(String query) search,
  }) async {
    if (_session == null) return;

    final start = _session!.startOffset;

    // Caret moved before [[ or beyond text → exit
    if (caretOffset < start + 2 || caretOffset > text.length) {
      end();
      return;
    }

    final raw = text.substring(start + 2, caretOffset);

    // User typed closing bracket or newline → exit
    if (raw.contains(']') || raw.contains('\n')) {
      end();
      return;
    }

    _query = raw;

    // Fetch results
    _results = await search(_query);
    _selectedIndex = 0;

    notifyListeners();
  }

  void end() {
    _session = null;
    _query = '';
    _results = [];
    _selectedIndex = 0;
    notifyListeners();
  }

  void cancel() => end();

  // --- Navigation ---
  void selectNext() {
    if (_results.isEmpty) return;
    _selectedIndex = (_selectedIndex + 1) % _results.length;
    notifyListeners();
  }

  void selectPrevious() {
    if (_results.isEmpty) return;
    _selectedIndex = (_selectedIndex - 1 + _results.length) % _results.length;
    notifyListeners();
  }

  String? get selectedResult {
    if (_results.isEmpty) return null;
    return _results[_selectedIndex];
  }
}
