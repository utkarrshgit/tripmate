"""
External data providers.

Agents and services never call a vendor directly: they use the interfaces in
`base.py`, and `registry.py` picks the implementation from settings. Adding a
vendor means adding a module here that implements the interface.
"""
