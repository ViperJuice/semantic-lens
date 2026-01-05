# Semantic Lens Development Guidelines

## UI Testing Requirements

**CRITICAL**: Any changes to the visualization MUST be tested thoroughly before declaring them complete:

### Mandatory Testing Checklist

1. **All Zoom Levels**
   - Test Universe (Directories) view
   - Test Galaxy (Files) view
   - Test System (Classes) view
   - Test Planet (All) view
   - Use BOTH zoom buttons AND mouse wheel zoom

2. **Navigation**
   - Pan left/right/up/down
   - Zoom in incrementally with mouse wheel
   - Zoom out incrementally with mouse wheel
   - Verify nodes remain visible and properly positioned at all zoom levels

3. **Visual Quality**
   - Community colors are visible and distinct
   - Community backgrounds (cosmic glow) render correctly
   - Labels are readable at appropriate zoom levels
   - Nodes don't overlap excessively
   - Node sizes are reasonable (not giant blobs)

4. **Multiple Fixtures**
   - Test with semantic-lens (small: ~3K chunks)
   - Test with Book-Vetting (large: ~256K chunks)
   - Test loading/switching between fixtures

5. **Interactive Features**
   - Click on nodes to select them
   - Verify info panel updates
   - Test edge visibility toggles

### Testing Script

Always use a comprehensive Playwright script that:
- Loads each fixture
- Clicks through ALL zoom level buttons
- Performs mouse wheel zoom in/out
- Pans the view
- Takes screenshots at each state
- Reports any console errors

### DO NOT declare a UI fix complete until:
1. You have run the full testing script
2. You have viewed ALL screenshots
3. Every zoom level and interaction works correctly
4. The user can immediately use the feature without issues

## Architecture Notes

- `.slb2` files: Tiered bundle format with pre-computed positions
- Tiers: universe (directories) -> galaxy (files) -> system (classes) -> planet (all)
- Community detection runs on loaded nodes
- Community backgrounds render as radial gradients on canvas layer
